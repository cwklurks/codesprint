"use client";

import { Box, Button, Flex, Text } from "@chakra-ui/react";

import { DailyShareBlock, StreakFlame } from "./DailyShareBlock";
import type { DailyBest } from "@/lib/daily-store";

export interface DailyChallengeCardProps {
    dateStr: string;
    dayNumber: number;
    streak: number;
    completed: boolean;
    /** Snippet language label (e.g. "python"); used in the share block. */
    language: string;
    /** Whether a daily snippet is available (false => pool empty / still loading). */
    available: boolean;
    /** Today's recorded result, present once completed. */
    todaysResult?: DailyBest;
    /** Start (or re-practice) today's daily run. */
    onStart: () => void;
    disabled?: boolean;
}

/**
 * Idle-screen entry for the Daily CodeSprint. Shows a start prompt before the
 * daily is done, and a completed summary + streak + Wordle-style copy block after.
 */
export function DailyChallengeCard({
    dateStr,
    dayNumber,
    streak,
    completed,
    language,
    available,
    todaysResult,
    onStart,
    disabled,
}: DailyChallengeCardProps) {
    return (
        <Box
            w="100%"
            bg="var(--panel-soft)"
            border="1px solid var(--border)"
            borderRadius="var(--radius-lg)"
            boxShadow="var(--shadow)"
            px={{ base: 5, md: 6 }}
            py={{ base: 4, md: 5 }}
        >
            <Flex
                align={{ base: "flex-start", md: "center" }}
                justify="space-between"
                gap={4}
                flexDirection={{ base: "column", md: "row" }}
            >
                <Box>
                    <Text fontSize="lg" fontWeight={700} color="var(--text)">
                        Daily Challenge #{dayNumber}
                    </Text>
                    <Text fontSize="sm" color="var(--text-subtle)" mt={1}>
                        {completed
                            ? "Done for today. Same snippet for everyone."
                            : "One snippet. Same for everyone. Build your streak."}
                    </Text>
                </Box>

                <Flex align="center" gap={4}>
                    {streak > 0 && (
                        <Flex align="center" gap={1.5}>
                            <StreakFlame size={18} />
                            <Text
                                fontSize="lg"
                                fontWeight={700}
                                color="var(--accent)"
                                fontVariantNumeric="tabular-nums"
                            >
                                {streak}
                            </Text>
                            <Text fontSize="sm" color="var(--text-subtle)">
                                day{streak === 1 ? "" : "s"}
                            </Text>
                        </Flex>
                    )}

                    <Button
                        onClick={onStart}
                        size="md"
                        variant={completed ? "outline" : "solid"}
                        bg={completed ? undefined : "var(--accent)"}
                        color={completed ? "var(--accent)" : "var(--bg)"}
                        borderColor="var(--accent)"
                        _hover={
                            completed
                                ? { bg: "var(--accent)", color: "var(--bg)" }
                                : {
                                      // A translucent theme scrim over the accent fill:
                                      // real hover feedback without fading the label
                                      // (opacity dimmed the text along with the button).
                                      backgroundImage:
                                          "linear-gradient(var(--overlay), var(--overlay))",
                                      borderColor: "var(--border-strong)",
                                      boxShadow: "var(--elev-1)",
                                  }
                        }
                        px={6}
                        disabled={disabled || !available}
                    >
                        {completed ? "Practice again" : "Start Daily"}
                    </Button>
                </Flex>
            </Flex>

            {completed && todaysResult && (
                <Flex direction="column" align="center" gap={4} mt={5} pt={5} borderTop="1px solid var(--border)">
                    <Flex gap={6} justify="center" flexWrap="wrap">
                        <Stat label="best wpm" value={Math.round(todaysResult.wpm).toString()} />
                        <Stat label="accuracy" value={`${Math.round(todaysResult.accuracy * 100)}%`} />
                    </Flex>
                    <DailyShareBlock
                        dateStr={dateStr}
                        dayNumber={dayNumber}
                        wpm={Math.round(todaysResult.wpm)}
                        accuracy={todaysResult.accuracy}
                        streak={streak}
                        language={language}
                    />
                </Flex>
            )}
        </Box>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <Box textAlign="center">
            <Text
                fontSize="2xl"
                fontWeight={700}
                color="var(--text)"
                lineHeight={1}
                fontVariantNumeric="tabular-nums"
            >
                {value}
            </Text>
            <Text fontSize="xs" color="var(--text-subtle)" textTransform="uppercase" letterSpacing="0.08em" mt={1}>
                {label}
            </Text>
        </Box>
    );
}
