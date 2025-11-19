import { useCallback, useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/lib/motion";

type UseAutoScrollProps = {
    cursorIndex: number;
    phase: "idle" | "countdown" | "running" | "finished";
    containerRef: React.RefObject<HTMLElement | null>;
    enabled?: boolean;
};

export function useAutoScroll({ cursorIndex, phase, containerRef, enabled = true }: UseAutoScrollProps) {
    const prefersReducedMotion = usePrefersReducedMotion();
    const skipNextAutoScrollRef = useRef(false);
    const suppressAutoScrollUntilRef = useRef<number | null>(null);
    const previousPhaseRef = useRef(phase);

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
            const targetTop = window.scrollY + rect.top - viewportHeight / 2 + rect.height / 2;
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

    // Continuous auto-scroll during running
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

        const rafId = window.requestAnimationFrame(() => {
            const caret = document.querySelector<HTMLElement>(".cs-caret");
            if (!caret) return;
            const rect = caret.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const behavior: ScrollBehavior = prefersReducedMotion ? "auto" : "smooth";
            const topBand = viewportHeight * 0.2;
            const bottomBand = viewportHeight * 0.75;
            const scrollElement = document.scrollingElement ?? document.documentElement ?? document.body;

            if (rect.bottom > bottomBand) {
                const delta = rect.bottom - bottomBand + 32;
                const maxDown =
                    scrollElement && viewportHeight
                        ? Math.max(0, scrollElement.scrollHeight - viewportHeight - window.scrollY)
                        : delta;
                const applied = Math.min(delta, maxDown);
                if (applied !== 0) {
                    window.scrollBy({ top: applied, behavior });
                }
                return;
            }

            if (rect.top < topBand && window.scrollY > 0) {
                const maxUp = -window.scrollY;
                const delta = Math.max(maxUp, rect.top - topBand - 32);
                if (delta !== 0) {
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

