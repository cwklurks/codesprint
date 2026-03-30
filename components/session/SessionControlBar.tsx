"use client";

import {
    Button,
    Flex,
    Text,
    Badge,
    TooltipRoot,
    TooltipTrigger,
    TooltipPositioner,
    TooltipContent,
} from "@chakra-ui/react";
import { AnimatePresence, motion } from "framer-motion";
import { getPillButtonStyles, getStartButtonStyles, SESSION_CSS_VARS } from "@/lib/session-styles";
import { getControlsMotion, getStartButtonMotion } from "@/lib/motion-config";
import type { SupportedLanguage } from "@/lib/snippets";
import type { LengthFilter } from "@/hooks/useSessionControls";
import type { Phase } from "@/hooks/useFocusManagement";
import type { Difficulty } from "@/lib/snippets";
import { getActiveProvider } from "@/lib/ai/key-storage";
import { checkRateLimit } from "@/lib/ai/rate-limiter";
import { useAIDrills } from "@/hooks/useAIDrills";
import { usePreferences } from "@/lib/preferences";

export type SurfaceStyle = "panel" | "immersive";

export interface SessionControlBarProps {
    /** Current language */
    language: SupportedLanguage;
    /** Callback when language changes */
    onLanguageChange: (lang: SupportedLanguage) => void;
    /** Current length preference */
    lengthPreference: LengthFilter;
    /** Callback when length preference changes */
    onLengthChange: (pref: LengthFilter) => void;
    /** Current surface style */
    surfaceStyle: SurfaceStyle;
    /** Callback when surface style changes */
    onSurfaceChange: (style: SurfaceStyle) => void;
    /** Callback when start button is clicked */
    onStart: () => void;
    /** Current phase */
    phase: Phase;
    /** Whether controls are disabled */
    disabled: boolean;
    /** Whether terminal mode is enabled */
    isTerminalMode: boolean;
    /** Whether user prefers reduced motion */
    prefersReducedMotion: boolean;
    /** Number of snippets due for review */
    dueCount?: number;
    /** Suggested difficulty from adaptive system */
    suggestedDifficulty?: Difficulty;
    /** Callback when AI Drill button is clicked */
    onOpenAIDrill?: () => void;
}

const LANGUAGE_OPTIONS: Array<{ value: SupportedLanguage; label: string }> = [
    { value: "javascript", label: "JavaScript" },
    { value: "python", label: "Python" },
    { value: "java", label: "Java" },
    { value: "cpp", label: "C++" },
];

const LENGTH_OPTIONS: Array<{ value: LengthFilter; label: string; helper: string }> = [
    { value: "all", label: "All", helper: "any length" },
    { value: "short", label: "Short", helper: "under ~15 lines" },
    { value: "medium", label: "Medium", helper: "tight 15-40 lines" },
    { value: "long", label: "Long", helper: "extended 40+ lines" },
];

const SURFACE_OPTIONS: Array<{ value: SurfaceStyle; label: string }> = [
    { value: "panel", label: "Framed" },
    { value: "immersive", label: "Immersive" },
];

/**
 * Control bar with language, length, surface style selectors and start button
 * Only visible when not in focus mode (running state)
 */
export function SessionControlBar({
    language,
    onLanguageChange,
    lengthPreference,
    onLengthChange,
    surfaceStyle,
    onSurfaceChange,
    onStart,
    phase,
    disabled,
    isTerminalMode,
    prefersReducedMotion,
    dueCount,
    suggestedDifficulty,
    onOpenAIDrill,
}: SessionControlBarProps) {
    const { panelGlass, border } = SESSION_CSS_VARS;
    const controlsMotion = getControlsMotion(prefersReducedMotion);
    const startButtonMotion = getStartButtonMotion(prefersReducedMotion);
    const startButtonStyles = getStartButtonStyles(isTerminalMode);

    // AI Drills
    const { preferences } = usePreferences();
    const ai = useAIDrills(preferences);
    const showAIDrill = preferences.aiDrillsEnabled && getActiveProvider() !== null && 
        phase !== "running" && phase !== "countdown";
    const rateLimit = checkRateLimit(preferences.aiMaxDrillsPerDay);

    return (
        <motion.div
            style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: "8px",
                padding: "6px 12px",
                borderRadius: "8px",
                background: panelGlass,
                backdropFilter: "blur(12px)",
                border: `1px solid ${border}`,
                boxShadow: "var(--shadow)",
                flexWrap: "wrap",
            }}
            {...controlsMotion}
            layout
        >
            {/* Language Selector */}
            <Flex gap={2} flexWrap="wrap" align="center">
                {LANGUAGE_OPTIONS.map((option) => (
                    <Button
                        key={option.value}
                        {...getPillButtonStyles(language === option.value, isTerminalMode)}
                        onClick={() => onLanguageChange(option.value)}
                        disabled={disabled}
                    >
                        {option.label}
                    </Button>
                ))}
            </Flex>

            {/* Length Selector */}
            <Flex gap={2} flexWrap="wrap" align="center" ml={2}>
                {LENGTH_OPTIONS.map((option) => (
                    <TooltipRoot key={option.value}>
                        <TooltipTrigger asChild>
                            <Button
                                {...getPillButtonStyles(lengthPreference === option.value, isTerminalMode)}
                                onClick={() => onLengthChange(option.value)}
                                disabled={disabled}
                            >
                                {option.label}
                            </Button>
                        </TooltipTrigger>
                        <TooltipPositioner>
                            <TooltipContent
                                bg="var(--surface)"
                                color="var(--text)"
                                border="1px solid var(--border)"
                                fontSize="xs"
                                px={2}
                                py={1}
                            >
                                {option.helper}
                            </TooltipContent>
                        </TooltipPositioner>
                    </TooltipRoot>
                ))}
            </Flex>

            {/* AI Drill Button */}
            {showAIDrill && (
                <TooltipRoot>
                    <TooltipTrigger asChild>
                        <Button
                            {...getPillButtonStyles(false, isTerminalMode)}
                            onClick={onOpenAIDrill}
                            disabled={!rateLimit.allowed}
                            ml={2}
                        >
                            ⚡ AI
                            <Badge ml={1} size="sm">{ai.remainingToday}</Badge>
                        </Button>
                    </TooltipTrigger>
                    <TooltipPositioner>
                        <TooltipContent
                            bg="var(--surface)"
                            color="var(--text)"
                            border="1px solid var(--border)"
                            fontSize="xs"
                            px={2}
                            py={1}
                        >
                            {!rateLimit.allowed ? rateLimit.reason : "Generate AI drill (Shift+A)"}
                        </TooltipContent>
                    </TooltipPositioner>
                </TooltipRoot>
            )}

            {/* Surface Style Selector */}
            <Flex gap={2} flexWrap="wrap" align="center" ml="auto">
                {SURFACE_OPTIONS.map((option) => (
                    <Button
                        key={option.value}
                        {...getPillButtonStyles(surfaceStyle === option.value, isTerminalMode)}
                        onClick={() => onSurfaceChange(option.value)}
                        disabled={disabled}
                    >
                        {option.label}
                    </Button>
                ))}
            </Flex>

            {/* Due count & suggested difficulty */}
            {(dueCount !== undefined && dueCount > 0) && (
                <Flex align="center" gap={1} px={2}>
                    <Text fontSize="xs" color="var(--accent)" fontWeight={600}>
                        📚 {dueCount} due
                    </Text>
                </Flex>
            )}
            {suggestedDifficulty && (
                <Text fontSize="xs" color="var(--text-subtle)" px={2}>
                    Suggested: <Text as="span" fontWeight={600} color="var(--text)">{suggestedDifficulty}</Text>
                </Text>
            )}

            {/* Start Button (only visible in idle phase) */}
            <AnimatePresence>
                {phase === "idle" && (
                    <motion.div {...startButtonMotion} layout style={{ display: "inline-flex" }}>
                        <Button onClick={onStart} {...startButtonStyles}>
                            Start
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
