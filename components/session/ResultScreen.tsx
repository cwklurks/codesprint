"use client";

import { Flex, Stack, Text } from "@chakra-ui/react";
import { m } from "framer-motion";
import ResultCard, { RESULT_POP_SPRING } from "@/components/ResultCard";
import { DailyShareBlock, StreakFlame } from "@/components/daily/DailyShareBlock";
import { MOTION_EASE } from "@/lib/motion";
import { getResultCardMotion } from "@/lib/motion-config";
import type { SupportedLanguage, SnippetLength } from "@/lib/snippets";
import type { ErrorEntry, HistoryEntry } from "@/hooks/useTypingEngine";
import type { Token } from "@/lib/tokenizer";
import type { AchievementDefinition } from "@/lib/achievements";
import type { Difficulty } from "@/lib/snippets";
import type { ThemePreset } from "@/lib/preferences-core";

export interface ResultScreenProps {
    /** Adjusted WPM score */
    wpm: number;
    /** Raw WPM based on total keystrokes */
    rawWpm: number;
    /** Accuracy percentage */
    accuracy: number;
    /** Time taken in milliseconds */
    timeMs: number;
    /** Number of errors */
    errors: number;
    /** Every key the run counted (the raw-WPM numerator) */
    totalKeystrokes: number;
    /** Of those, the ones that matched the snippet (the accuracy numerator) */
    correctKeystrokes: number;
    /** Active theme, so the card's primary action can carry its accent fill */
    theme?: ThemePreset;
    /** Snippet title */
    snippetTitle: string;
    /** Snippet ID */
    snippetId: string;
    /** Programming language */
    language: SupportedLanguage;
    /** Snippet difficulty */
    difficulty: string;
    /** Snippet length category */
    lengthCategory: SnippetLength;
    /** Error log for analysis */
    errorLog: ErrorEntry[];
    /** Typing history for graphs */
    history: HistoryEntry[];
    /** Auto-advance deadline timestamp (null if not set) */
    autoAdvanceDeadline: number | null;
    /** Whether next problem action is available */
    canAdvance: boolean;
    /** Callback when next button is clicked */
    onNext: () => void;
    /** Whether user prefers reduced motion */
    prefersReducedMotion: boolean;
    /** Pattern score (0-100) */
    patternScore?: number;
    /** Tokens from the snippet */
    tokens?: Token[];
    /** Content length for pattern analysis */
    contentLength?: number;
    /** XP gained from this session */
    xpGained?: number;
    /** Achievements unlocked this session */
    newlyUnlocked?: AchievementDefinition[];
    /** Difficulty transition suggestion */
    difficultyTransition?: { newDifficulty: Difficulty; reason: string };
    /** Whether the snippet was AI-generated */
    isAIDrill?: boolean;
    /** Best WPM across all prior runs, excluding the current run */
    priorBestWpm?: number;
    /** Whether the just-finished run set a new personal best */
    isNewBest?: boolean;
    /** Present when the finished run was the Daily Challenge; drives the share block */
    daily?: {
        dateStr: string;
        dayNumber: number;
        streak: number;
    };
}

const MotionFlex = m.create(Flex);
const MotionText = m.create(Text);

/**
 * Everything under the card joins the same reveal cascade the card runs
 * internally, so the whole screen resolves as one sequence rather than as a
 * card followed by a second wave of unrelated fades.
 */
function reveal(prefersReducedMotion: boolean, delay: number) {
    if (prefersReducedMotion) return {};
    return {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.32, ease: MOTION_EASE.out, delay },
    };
}

/**
 * Result screen shown when typing session is finished
 * Contains the centered result card and optional achievement metadata
 */
export function ResultScreen({
    wpm,
    rawWpm,
    accuracy,
    timeMs,
    errors,
    totalKeystrokes,
    correctKeystrokes,
    theme,
    snippetTitle,
    snippetId,
    language,
    difficulty,
    lengthCategory,
    errorLog,
    history,
    autoAdvanceDeadline,
    canAdvance,
    onNext,
    prefersReducedMotion,
    patternScore,
    tokens,
    contentLength,
    xpGained,
    newlyUnlocked,
    difficultyTransition,
    isAIDrill,
    priorBestWpm,
    isNewBest,
    daily,
}: ResultScreenProps) {
    const resultCardMotion = getResultCardMotion(prefersReducedMotion);

    return (
        <m.div
            key="result"
            {...resultCardMotion}
            style={{
                width: "100%",
                display: "flex",
                justifyContent: "center",
                marginTop: 32,
            }}
        >
            <Stack gap={5} align="center" w="100%" maxW="1000px">
                <ResultCard
                    wpm={wpm}
                    rawWpm={rawWpm}
                    accuracy={accuracy}
                    timeMs={timeMs}
                    errors={errors}
                    totalKeystrokes={totalKeystrokes}
                    correctKeystrokes={correctKeystrokes}
                    theme={theme}
                    onNext={canAdvance ? onNext : undefined}
                    autoAdvanceDeadline={autoAdvanceDeadline}
                    snippetTitle={snippetTitle}
                    snippetId={snippetId}
                    language={language}
                    difficulty={difficulty}
                    lengthCategory={lengthCategory}
                    errorLog={errorLog}
                    history={history}
                    patternScore={patternScore}
                    tokens={tokens}
                    contentLength={contentLength}
                    isAIDrill={isAIDrill}
                    priorBestWpm={priorBestWpm}
                    isNewBest={isNewBest}
                />

                {daily && (
                    <MotionFlex {...reveal(prefersReducedMotion, 0.4)} direction="column" align="center" gap={3}>
                        <Flex align="center" gap={1.5}>
                            <StreakFlame />
                            <Text
                                fontSize="lg"
                                fontWeight={700}
                                color="var(--accent)"
                                fontVariantNumeric="tabular-nums"
                            >
                                {daily.streak}
                            </Text>
                            <Text fontSize="sm" color="var(--text-subtle)">
                                day{daily.streak === 1 ? "" : "s"} streak
                            </Text>
                        </Flex>
                        <DailyShareBlock
                            dateStr={daily.dateStr}
                            dayNumber={daily.dayNumber}
                            wpm={Math.round(wpm)}
                            accuracy={accuracy}
                            patternScore={patternScore}
                            streak={daily.streak}
                            language={language}
                        />
                    </MotionFlex>
                )}

                {(xpGained !== undefined && xpGained > 0) && (
                    <MotionText
                        {...reveal(prefersReducedMotion, 0.44)}
                        fontSize="md"
                        fontWeight={600}
                        color="var(--accent)"
                        fontVariantNumeric="tabular-nums"
                    >
                        +{xpGained} XP
                    </MotionText>
                )}

                {newlyUnlocked && newlyUnlocked.length > 0 && (
                    <Flex gap={2} flexWrap="wrap" justify="center">
                        {newlyUnlocked.map((a, i) => (
                            <MotionFlex
                                key={a.id}
                                {...(prefersReducedMotion
                                    ? {}
                                    : {
                                          initial: { opacity: 0, scale: 0.8 },
                                          animate: { opacity: 1, scale: 1 },
                                          // Same pop as the NEW BEST badge; capped so a
                                          // big unlock batch never drags the sequence out.
                                          transition: { ...RESULT_POP_SPRING, delay: 0.46 + Math.min(i, 3) * 0.05 },
                                      })}
                                align="center"
                                gap={1.5}
                                px={3}
                                py={1}
                                borderRadius="full"
                                bg="var(--surface)"
                                border="1px solid var(--border)"
                            >
                                <Text fontSize="sm" lineHeight={1}>{a.icon}</Text>
                                <Text fontSize="xs" fontWeight={600} color="var(--text)">{a.name}</Text>
                            </MotionFlex>
                        ))}
                    </Flex>
                )}

                {difficultyTransition && difficultyTransition.reason !== "unchanged" && (
                    <MotionText {...reveal(prefersReducedMotion, 0.52)} fontSize="sm" color="var(--text-subtle)">
                        Difficulty adjusted to <Text as="span" fontWeight={600} color="var(--accent)">{difficultyTransition.newDifficulty}</Text>
                    </MotionText>
                )}
            </Stack>
        </m.div>
    );
}
