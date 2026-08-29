"use client";

import {
    Button,
    Flex,
    Text,
    TooltipRoot,
    TooltipTrigger,
    TooltipPositioner,
    TooltipContent,
    chakra,
} from "@chakra-ui/react";
import type { IconProps as ChakraIconProps } from "@chakra-ui/react";
import { AnimatePresence, m } from "framer-motion";
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
 * Between the filter groups this is a full-width hairline while the bar is
 * stacked and a vertical rule once it fits on one line (app/globals.css). The
 * `inline` variant rides with the Start button and only exists in the wide
 * layout.
 */
function Divider({ inline = false }: { inline?: boolean }) {
    return (
        <span
            className={inline ? "session-control-divider session-control-divider-inline" : "session-control-divider"}
            aria-hidden="true"
        />
    );
}

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

    // AI Drills
    const { preferences } = usePreferences();
    const startButtonStyles = getStartButtonStyles(isTerminalMode, preferences.theme);
    const ai = useAIDrills(preferences);
    const showAIDrill = preferences.aiDrillsEnabled && getActiveProvider() !== null &&
        phase !== "running" && phase !== "countdown";
    const rateLimit = checkRateLimit(preferences.aiMaxDrillsPerDay);

    const hasDue = dueCount !== undefined && dueCount > 0;
    const showMetaRow = hasDue || Boolean(suggestedDifficulty);

    return (
        <m.div
            className="session-control-bar"
            style={{
                background: panelGlass,
                border: `1px solid ${border}`,
            }}
            {...controlsMotion}
            layout
        >
            <div className="session-control-row">
                {/* Filters: language, length, appearance — one visual band */}
                <Flex gap={2} flexWrap="wrap" align="center" role="group" aria-label="Language">
                    {LANGUAGE_OPTIONS.map((option) => (
                        <Button
                            key={option.value}
                            {...getPillButtonStyles(language === option.value, isTerminalMode)}
                            aria-pressed={language === option.value}
                            onClick={() => onLanguageChange(option.value)}
                            disabled={disabled}
                        >
                            {option.label}
                        </Button>
                    ))}
                </Flex>

                <Divider />

                <Flex gap={2} flexWrap="wrap" align="center" role="group" aria-label="Snippet length">
                    {LENGTH_OPTIONS.map((option) => (
                        <TooltipRoot key={option.value}>
                            <TooltipTrigger asChild>
                                <Button
                                    {...getPillButtonStyles(lengthPreference === option.value, isTerminalMode)}
                                    aria-pressed={lengthPreference === option.value}
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

                <Divider />

                <Flex gap={2} flexWrap="wrap" align="center" role="group" aria-label="Appearance">
                    {SURFACE_OPTIONS.map((option) => (
                        <Button
                            key={option.value}
                            {...getPillButtonStyles(surfaceStyle === option.value, isTerminalMode)}
                            aria-pressed={surfaceStyle === option.value}
                            onClick={() => onSurfaceChange(option.value)}
                            disabled={disabled}
                        >
                            {option.label}
                        </Button>
                    ))}
                </Flex>

                {/* Actions live in their own slot at the far end of the bar */}
                <Flex gap={3} align="center" ml="auto" flexWrap="wrap">
                    {showAIDrill && (
                        <TooltipRoot>
                            <TooltipTrigger asChild>
                                <Button
                                    {...getPillButtonStyles(false, isTerminalMode)}
                                    onClick={onOpenAIDrill}
                                    disabled={!rateLimit.allowed}
                                    gap={1.5}
                                >
                                    <BoltIcon boxSize={3.5} />
                                    AI
                                    <Text as="span" fontSize="xs" color="var(--text-subtle)" fontVariantNumeric="tabular-nums">
                                        {ai.remainingToday}
                                    </Text>
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
                                    {!rateLimit.allowed ? rateLimit.reason : "Generate AI drill (Shift+A on the result screen)"}
                                </TooltipContent>
                            </TooltipPositioner>
                        </TooltipRoot>
                    )}

                    <AnimatePresence>
                        {phase === "idle" && (
                            <m.div {...startButtonMotion} layout style={{ display: "inline-flex" }}>
                                <Divider inline />
                                <Button onClick={onStart} {...startButtonStyles} ml={3}>
                                    Start
                                </Button>
                            </m.div>
                        )}
                    </AnimatePresence>
                </Flex>
            </div>

            {/* Secondary line: session context, not controls */}
            {showMetaRow && (
                <div className="session-control-meta">
                    {hasDue && (
                        <Flex align="center" gap={1.5} color="var(--accent)">
                            <DueIcon boxSize={3.5} />
                            <Text fontSize="xs" fontWeight={600} fontVariantNumeric="tabular-nums">
                                {dueCount} due for review
                            </Text>
                        </Flex>
                    )}
                    {suggestedDifficulty && (
                        <Text fontSize="xs" color="var(--text-subtle)">
                            Suggested:{" "}
                            <Text as="span" fontWeight={600} color="var(--text)">
                                {suggestedDifficulty}
                            </Text>
                        </Text>
                    )}
                </div>
            )}
        </m.div>
    );
}

function BoltIcon(props: ChakraIconProps) {
    return (
        <chakra.svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            {...props}
        >
            <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
        </chakra.svg>
    );
}

function DueIcon(props: ChakraIconProps) {
    return (
        <chakra.svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            {...props}
        >
            <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H5.5A1.5 1.5 0 0 1 4 15.5z" />
            <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h4.5a1.5 1.5 0 0 0 1.5-1.5z" />
        </chakra.svg>
    );
}
