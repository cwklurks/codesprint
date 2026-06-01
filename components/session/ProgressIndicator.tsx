"use client";

import { Box } from "@chakra-ui/react";
import { m } from "framer-motion";
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

/**
 * Progress indicator component with two variants:
 * - Terminal mode: ASCII progress bar [████████░░░░] 67%
 * - Standard mode: Animated gradient progress bar
 */
export function ProgressIndicator({
    progress,
    isTerminalMode,
    isImmersive,
    showChrome,
    prefersReducedMotion,
}: ProgressIndicatorProps) {
    const { panelGlass, accent, surface } = SESSION_CSS_VARS;

    // Don't render if chrome is hidden
    if (!showChrome) return null;

    const progressPercent = Math.round(progress * 100);

    // Terminal mode: ASCII progress bar
    if (isTerminalMode) {
        const terminalFilled = Math.min(TERMINAL_BAR_WIDTH, Math.max(0, Math.round(progress * TERMINAL_BAR_WIDTH)));
        const terminalBar = "█".repeat(terminalFilled) + "░".repeat(TERMINAL_BAR_WIDTH - terminalFilled);
        const terminalProgressText = `[${terminalBar}] ${progressPercent.toString().padStart(3, " ")}%`;

        return (
            <Box
                border="1px solid var(--border)"
                borderRadius="md"
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

    // Immersive mode: no progress bar
    if (isImmersive) return null;

    // Standard mode: animated gradient progress bar
    return (
        <Box borderRadius="full" bg={surface} h="6px" overflow="hidden" w="100%" maxW="360px">
            <m.div
                initial={false}
                animate={{ scaleX: progress }}
                transition={
                    prefersReducedMotion
                        ? { duration: 0.01 }
                        : { type: "spring", stiffness: 210, damping: 28, mass: 0.45 }
                }
                style={{
                    height: "100%",
                    width: "100%",
                    background: "linear-gradient(90deg, var(--accent) 0%, transparent 100%)",
                    borderRadius: "inherit",
                    transformOrigin: "0% 50%",
                }}
            />
        </Box>
    );
}
