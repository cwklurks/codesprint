import { useCallback, useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/lib/motion";

type UseAutoScrollProps = {
    cursorIndex: number;
    phase: "idle" | "countdown" | "running" | "finished";
    containerRef: React.RefObject<HTMLElement | null>;
    enabled?: boolean;
};

// Throttle scroll checks to avoid RAF overhead on every keystroke
const SCROLL_CHECK_INTERVAL_MS = 100;
const SCROLL_CHECK_KEYSTROKE_INTERVAL = 5;

export function useAutoScroll({ cursorIndex, phase, containerRef, enabled = true }: UseAutoScrollProps) {
    const prefersReducedMotion = usePrefersReducedMotion();
    const skipNextAutoScrollRef = useRef(false);
    const suppressAutoScrollUntilRef = useRef<number | null>(null);
    const previousPhaseRef = useRef(phase);
    const lastScrollCheckRef = useRef(0);
    const lastScrollCheckCursorRef = useRef(0);

    const scrollSessionIntoView = useCallback(() => {
        if (typeof window === "undefined") return;
        const container = containerRef.current;
        if (!container) return;
        const behavior: ScrollBehavior = prefersReducedMotion ? "auto" : "smooth";

        const performScroll = () => {
            const caret = document.querySelector<HTMLElement>(".cs-caret");
            const rect = (caret ?? container).getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const scrollElement = document.scrollingElement ?? document.documentElement ?? document.body;
            // Seat the active line at ~42% of the viewport — matches the running follow
            // target so the run starts centered and stays there (no initial re-settle).
            const targetTop = window.scrollY + rect.top - viewportHeight * 0.42;
            const maxTop =
                scrollElement && viewportHeight
                    ? Math.max(0, scrollElement.scrollHeight - viewportHeight)
                    : Number.POSITIVE_INFINITY;
            const clampedTop = Math.max(0, Math.min(targetTop, maxTop));
            if (Math.abs(clampedTop - window.scrollY) < 1) return;
            skipNextAutoScrollRef.current = true;
            suppressAutoScrollUntilRef.current = Date.now() + 800;
            window.scrollTo({
                top: clampedTop,
                behavior,
            });
        };

        if (prefersReducedMotion) {
            performScroll();
        } else {
            window.requestAnimationFrame(() => {
                window.requestAnimationFrame(performScroll);
            });
        }
    }, [prefersReducedMotion, containerRef]);

    // Scroll into view on phase change
    useEffect(() => {
        const prev = previousPhaseRef.current;
        const enteringCountdown = phase === "countdown" && prev !== "countdown";
        const enteringRunningDirect = phase === "running" && prev !== "running" && prev !== "countdown";
        if (enteringCountdown || enteringRunningDirect) {
            scrollSessionIntoView();
        }
        previousPhaseRef.current = phase;
    }, [phase, scrollSessionIntoView]);

    // Continuous auto-scroll during running (throttled to avoid RAF overhead on every keystroke)
    useEffect(() => {
        if (typeof window === "undefined") return;
        if (phase !== "running" || !enabled) return;

        const suppressUntil = suppressAutoScrollUntilRef.current;
        if (suppressUntil && Date.now() < suppressUntil) {
            return;
        }
        if (suppressUntil && Date.now() >= suppressUntil) {
            suppressAutoScrollUntilRef.current = null;
        }
        if (skipNextAutoScrollRef.current) {
            skipNextAutoScrollRef.current = false;
            return;
        }

        // Throttle: skip if not enough time/keystrokes have passed
        const nowTs = Date.now();
        const cursorDelta = cursorIndex - lastScrollCheckCursorRef.current;
        const timeDelta = nowTs - lastScrollCheckRef.current;

        // Only check scroll if enough time OR enough keystrokes have passed
        if (timeDelta < SCROLL_CHECK_INTERVAL_MS && cursorDelta < SCROLL_CHECK_KEYSTROKE_INTERVAL) {
            return;
        }

        lastScrollCheckRef.current = nowTs;
        lastScrollCheckCursorRef.current = cursorIndex;

        const rafId = window.requestAnimationFrame(() => {
            const caret = document.querySelector<HTMLElement>(".cs-caret");
            if (!caret) return;
            const rect = caret.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const behavior: ScrollBehavior = prefersReducedMotion ? "auto" : "smooth";
            const scrollElement = document.scrollingElement ?? document.documentElement ?? document.body;

            // Keep the active line centered at ~42% of the viewport so it holds a steady
            // height and the code flows up underneath it (Monkeytype-style follow), with
            // read-ahead visible below. A ~1-line dead-band absorbs the per-line caret hop
            // so we re-center smoothly instead of micro-scrolling on every keystroke.
            const targetTop = viewportHeight * 0.42;
            const deadband = Math.max(20, rect.height);

            if (rect.top > targetTop + deadband) {
                const delta = rect.top - targetTop;
                const maxDown =
                    scrollElement && viewportHeight
                        ? Math.max(0, scrollElement.scrollHeight - viewportHeight - window.scrollY)
                        : delta;
                const applied = Math.min(delta, maxDown);
                if (applied > 0.5) {
                    window.scrollBy({ top: applied, behavior });
                }
                return;
            }

            if (rect.top < targetTop - deadband && window.scrollY > 0) {
                const maxUp = -window.scrollY;
                const delta = Math.max(maxUp, rect.top - targetTop);
                if (delta < -0.5) {
                    window.scrollBy({ top: delta, behavior });
                }
            }
        });
        return () => {
            window.cancelAnimationFrame(rafId);
        };
    }, [cursorIndex, phase, prefersReducedMotion, enabled]);

    return { scrollSessionIntoView };
}

