"use client";

import { AnimatePresence, m } from "framer-motion";
import { getCountdownOverlayMotion, getCountdownNumberMotion } from "@/lib/motion-config";

export interface CountdownOverlayProps {
    /** Whether the countdown is active */
    isActive: boolean;
    /** Current countdown value (3, 2, 1, 0) or null */
    countdownValue: number | null;
    /** Whether user prefers reduced motion */
    prefersReducedMotion: boolean;
}

/**
 * Countdown overlay that displays 3 -> 2 -> 1 -> Go with scale/fade animation
 * Positioned absolutely over the code panel
 */
export function CountdownOverlay({
    isActive,
    countdownValue,
    prefersReducedMotion,
}: CountdownOverlayProps) {
    const overlayMotion = getCountdownOverlayMotion(prefersReducedMotion);
    const numberMotion = getCountdownNumberMotion(prefersReducedMotion);

    return (
        <AnimatePresence mode="wait">
            {isActive && countdownValue !== null && (
                <m.div
                    key="countdown-overlay"
                    {...overlayMotion}
                    style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: prefersReducedMotion ? "transparent" : "var(--overlay)",
                        backdropFilter: prefersReducedMotion ? undefined : "blur(10px)",
                    }}
                >
                    <AnimatePresence mode="wait">
                        <m.span
                            key={countdownValue}
                            {...numberMotion}
                            style={{
                                fontSize: "4rem",
                                fontWeight: 700,
                                color: "var(--text)",
                                textShadow: "0 12px 34px color-mix(in srgb, var(--bg) 40%, transparent)",
                            }}
                        >
                            {countdownValue === 0 ? "Go" : countdownValue}
                        </m.span>
                    </AnimatePresence>
                </m.div>
            )}
        </AnimatePresence>
    );
}
