"use client";

import { Box } from "@chakra-ui/react";
import { m } from "framer-motion";
import type { Transition } from "framer-motion";
import { SESSION_CSS_VARS, MONO_FONT_STACK } from "@/lib/session-styles";

export interface ProgressIndicatorProps {
    /** Progress value from 0 to 1 */
    progress: number;
    /** Whether terminal mode is enabled */
    isTerminalMode: boolean;
    /** Whether immersive surface style is enabled */
    isImmersive: boolean;
    /** Whether to show the chrome (UI elements) */
    showChrome: boolean;
    /** Whether user prefers reduced motion */
    prefersReducedMotion: boolean;
}

const TERMINAL_BAR_WIDTH = 24;

function fillTransition(prefersReducedMotion: boolean): Transition {
    return prefersReducedMotion
        ? { duration: 0.01 }
        : { type: "spring", stiffness: 210, damping: 28, mass: 0.45 };
}

/**
 * Progress indicator with three variants:
 * - Terminal mode: ASCII progress bar [████████░░░░] 67%
 * - Immersive: a 2px accent rail pinned to the top of the viewport
 * - Framed: an inline accent bar next to the problem summary
 */
export function ProgressIndicator({
    progress,
    isTerminalMode,
    isImmersive,
    showChrome,
    prefersReducedMotion,
}: ProgressIndicatorProps) {
    const { panelGlass, accent, surface } = SESSION_CSS_VARS;
    const progressPercent = Math.round(progress * 100);

    // Immersive is the surface style that strips the frame away, so the run's only
    // progress signal is a hairline across the top of the viewport. It is checked
    // before the chrome gate on purpose: the chrome is down for the whole run,
    // which is exactly when this rail has to be visible.
    if (isImmersive && !isTerminalMode) {
        return (
            <Box
                position="fixed"
                top={0}
                left={0}
                right={0}
                h="2px"
                zIndex={40}
                pointerEvents="none"
                role="progressbar"
                aria-label="Snippet progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progressPercent}
            >
                <m.div
                    initial={false}
                    animate={{ scaleX: progress }}
                    transition={fillTransition(prefersReducedMotion)}
                    style={{
                        height: "100%",
                        width: "100%",
                        background: accent,
                        transformOrigin: "0% 50%",
                    }}
                />
            </Box>
        );
    }

    // Don't render if chrome is hidden
    if (!showChrome) return null;

    // Terminal mode: ASCII progress bar
    if (isTerminalMode) {
        const terminalFilled = Math.min(TERMINAL_BAR_WIDTH, Math.max(0, Math.round(progress * TERMINAL_BAR_WIDTH)));
        const terminalBar = "█".repeat(terminalFilled) + "░".repeat(TERMINAL_BAR_WIDTH - terminalFilled);
        const terminalProgressText = `[${terminalBar}] ${progressPercent.toString().padStart(3, " ")}%`;

        return (
            <Box
                border="1px solid var(--border)"
                borderRadius="var(--radius-sm)"
                bg={panelGlass}
                px={4}
                py={2}
                fontFamily={MONO_FONT_STACK}
                fontSize="sm"
                letterSpacing="0.08em"
                color={accent}
            >
                {terminalProgressText}
            </Box>
        );
    }

    // Framed mode: inline accent bar
    return (
        <Box borderRadius="full" bg={surface} h="6px" overflow="hidden" w="100%" maxW="360px">
            <m.div
                initial={false}
                animate={{ scaleX: progress }}
                transition={fillTransition(prefersReducedMotion)}
                style={{
                    height: "100%",
                    width: "100%",
                    // A gradient to transparent made the fill read as thinner than it
                    // is at low progress; a solid accent tracks the real value.
                    background: accent,
                    borderRadius: "inherit",
                    transformOrigin: "0% 50%",
                }}
            />
        </Box>
    );
}
