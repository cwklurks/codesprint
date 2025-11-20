"use client";

import { Box, Button, Flex, Stack, Text } from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { usePrefersReducedMotion } from "@/lib/motion";
import ResultGraph from "./ResultGraph";

type ErrorEntry = { expected: string; got: string; index: number };

type ResultCardProps = {
    wpm: number;
    acc: number;
    timeMs: number;
    errors: number;
    snippetTitle: string;
    snippetId: string;
    lang: "javascript" | "python" | "java" | "cpp";
    difficulty: string;
    lengthCategory: string;
    errorLog: ErrorEntry[];
    onReplay: () => void;
    onNext?: () => void;
    autoAdvanceDeadline: number | null;
};

function formatDuration(ms: number) {
    if (ms <= 0) return "0s";
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = Math.floor(seconds / 60);
    const remaining = Math.round(seconds % 60);
    return `${minutes}m ${remaining}s`;
}

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.08,
            delayChildren: 0.1,
        },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { type: "spring", stiffness: 280, damping: 24 }
    },
} as const;

export default function ResultCard({
    wpm,
    acc,
    timeMs,
    errors,
    snippetTitle,
    snippetId,
    lang,
    difficulty,
    lengthCategory,
    errorLog,
    history,
    onReplay,
    onNext,
    autoAdvanceDeadline,
}: ResultCardProps & { history: any[] }) {
    const [countdown, setCountdown] = useState<number | null>(null);
    const prefersReducedMotion = usePrefersReducedMotion();

    useEffect(() => {
        if (!autoAdvanceDeadline) {
            setCountdown(null);
            return;
        }
        const tick = () => {
            setCountdown(Math.max(0, Math.ceil((autoAdvanceDeadline - Date.now()) / 1000)));
        };
        tick();
        const interval = setInterval(tick, 250);
        return () => clearInterval(interval);
    }, [autoAdvanceDeadline]);

    const mostMistaken = useMemo(() => {
        const counts: Record<string, number> = {};
        errorLog.forEach((e) => {
            const char = e.expected === " " ? "Space" : e.expected === "\n" ? "Enter" : e.expected;
            counts[char] = (counts[char] || 0) + 1;
        });
        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
    }, [errorLog]);

    const MotionBox = motion(Box);
    const MotionFlex = motion(Flex);
    const MotionStack = motion(Stack);

    const animationProps = prefersReducedMotion ? {} : {
        variants: containerVariants,
        initial: "hidden",
        animate: "visible"
    };

    const itemProps = prefersReducedMotion ? {} : { variants: itemVariants };

    return (
        <MotionBox
            borderRadius="20px"
            border="1px solid var(--border)"
            bg="var(--panel-soft)"
            boxShadow="var(--shadow)"
            p={{ base: 5, md: 8 }}
            w="100%"
            maxW="1000px"
            {...animationProps}
        >
            <Stack gap={8}>
                {/* Header */}
                <MotionFlex justify="center" gap={16} align="flex-end" {...itemProps}>
                    <Box textAlign="center">
                        <Text fontSize="6xl" fontWeight={700} color="var(--accent)" lineHeight={1}>
                            {Math.round(wpm)}
                        </Text>
                        <Text fontSize="xl" color="var(--text-subtle)">wpm</Text>
                    </Box>
                    <Box textAlign="center">
                        <Text fontSize="6xl" fontWeight={700} color="var(--text)" lineHeight={1}>
                            {(acc * 100).toFixed(0)}%
                        </Text>
                        <Text fontSize="xl" color="var(--text-subtle)">acc</Text>
                    </Box>
                </MotionFlex>

                {/* Graph */}
                <MotionBox h="300px" w="100%" {...itemProps}>
                    <ResultGraph data={history} height={300} />
                </MotionBox>

                {/* Detailed Stats */}
                <MotionFlex gap={8} flexWrap="wrap" justify="center" {...itemProps}>
                    <StatBox label="Raw" value={Math.round(wpm / acc || wpm).toString()} />
                    <StatBox label="Characters" value={`${history[history.length - 1]?.raw * 5 || 0}/${errors}`} helper="correct/incorrect" />
                    <StatBox label="Time" value={formatDuration(timeMs)} />
                </MotionFlex>

                {/* Most Mistaken */}
                {mostMistaken.length > 0 && (
                    <MotionBox {...itemProps} textAlign="center">
                        <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.1em" color="var(--text-subtle)" mb={3}>
                            Most Mistaken
                        </Text>
                        <Flex gap={3} flexWrap="wrap" justify="center">
                            {mostMistaken.map(([char, count]) => (
                                <Flex
                                    key={char}
                                    align="center"
                                    gap={2}
                                    bg="var(--surface)"
                                    px={3}
                                    py={1.5}
                                    borderRadius="md"
                                    border="1px solid var(--border)"
                                >
                                    <Text fontWeight="bold" fontFamily="monospace">{char}</Text>
                                    <Text fontSize="xs" color="var(--error)">{count}</Text>
                                </Flex>
                            ))}
                        </Flex>
                    </MotionBox>
                )}

                {/* Actions */}
                <MotionFlex gap={3} flexWrap="wrap" justify="center" pt={4} borderTop="1px solid var(--border)" {...itemProps}>
                    <Button onClick={onReplay} size="lg" colorScheme="yellow" px={8}>
                        Replay
                    </Button>
                    {onNext && (
                        <Button
                            onClick={onNext}
                            size="lg"
                            variant="outline"
                            borderColor="var(--accent)"
                            color="var(--accent)"
                            _hover={{ bg: "var(--accent)", color: "var(--bg)" }}
                            px={8}
                        >
                            Next Problem
                        </Button>
                    )}
                </MotionFlex>

                {countdown !== null && countdown > 0 && (
                    <Text textAlign="center" fontSize="xs" color="var(--text-subtle)">
                        Auto-advancing in {countdown}s…
                    </Text>
                )}
            </Stack>
        </MotionBox>
    );
}

function StatBox({ label, value, helper }: { label: string; value: string; helper?: string }) {
    return (
        <Box textAlign="center">
            <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.1em" color="var(--text-subtle)">
                {label}
            </Text>
            <Text fontSize="3xl" fontWeight={700} lineHeight={1.2}>
                {value}
            </Text>
            {helper && (
                <Text fontSize="xs" color="var(--text-subtle)" opacity={0.7}>
                    {helper}
                </Text>
            )}
        </Box>
    );
}


