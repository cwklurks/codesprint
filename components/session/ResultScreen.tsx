"use client";

import { Flex, Stack, Text } from "@chakra-ui/react";
import { m } from "framer-motion";
import ResultCard from "@/components/ResultCard";
import { DailyShareBlock } from "@/components/daily/DailyShareBlock";
import { getResultCardMotion } from "@/lib/motion-config";
import type { SupportedLanguage, SnippetLength } from "@/lib/snippets";
import type { ErrorEntry, HistoryEntry } from "@/hooks/useTypingEngine";
import type { Token } from "@/lib/tokenizer";
import type { AchievementDefinition } from "@/lib/achievements";
import type { Difficulty } from "@/lib/snippets";

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
                    <Flex direction="column" align="center" gap={3}>
                        <Flex align="center" gap={1.5}>
                            <Text fontSize="lg" lineHeight={1}>🔥</Text>
                            <Text fontSize="lg" fontWeight={700} color="var(--accent)">
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
                    </Flex>
                )}

                {(xpGained !== undefined && xpGained > 0) && (
                    <Text fontSize="md" fontWeight={600} color="var(--accent)">
                        +{xpGained} XP
                    </Text>
                )}

                {newlyUnlocked && newlyUnlocked.length > 0 && (
                    <Flex gap={2} flexWrap="wrap" justify="center">
                        {newlyUnlocked.map((a) => (
                            <Flex
                                key={a.id}
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
                            </Flex>
                        ))}
                    </Flex>
                )}

                {difficultyTransition && difficultyTransition.reason !== "unchanged" && (
                    <Text fontSize="sm" color="var(--text-subtle)">
                        Difficulty adjusted to <Text as="span" fontWeight={600} color="var(--accent)">{difficultyTransition.newDifficulty}</Text>
                    </Text>
                )}
            </Stack>
        </m.div>
    );
}
