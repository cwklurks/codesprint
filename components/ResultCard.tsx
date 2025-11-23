"use client";

import { Badge, Box, Button, Flex, Stack, Text } from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { usePrefersReducedMotion } from "@/lib/motion";
import ResultGraph, { type ResultGraphPoint } from "./ResultGraph";

type ErrorEntry = { expected: string; got: string; index: number };

type ResultCardProps = {
    wpm: number;
    accuracy: number;
    timeMs: number;
    errors: number;
    snippetTitle: string;
    snippetId: string;
    language: "javascript" | "python" | "java" | "cpp";
    difficulty: string;
    lengthCategory: string;
    errorLog: ErrorEntry[];
    onReplay: () => void;
    onNext?: () => void;
    autoAdvanceDeadline: number | null;
    history: ResultGraphPoint[];
};

function formatDuration(ms: number) {
    if (ms <= 0) return "0s";
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = Math.floor(seconds / 60);
    const remaining = Math.round(seconds % 60);
    return `${minutes}m ${remaining}s`;
}

function capitalize(value: string) {
    if (!value) return "";
    return value.charAt(0).toUpperCase() + value.slice(1);
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
    onReplay,
    onNext,
    autoAdvanceDeadline,
}: ResultCardProps) {
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

    const meta = useMemo(
        () => [
            { label: "Problem", value: snippetTitle || snippetId },
            { label: "Language", value: language.toUpperCase() },
            { label: "Difficulty", value: capitalize(difficulty) },
            { label: "Length", value: capitalize(lengthCategory) },
        ],
        [difficulty, language, lengthCategory, snippetId, snippetTitle]
    );

    const animationProps = prefersReducedMotion ? {} : {
        variants: containerVariants,
        initial: "hidden",
        animate: "visible"
    };

    const itemProps = prefersReducedMotion ? {} : { variants: itemVariants };

    // Simple normal distribution approximation for WPM percentiles
    // Mean ~40 WPM, SD ~15 for general population.
    // For a coding app, maybe slightly higher? Let's stick to general for "wow" factor or slightly higher for realism.
    // Let's use Mean=45, SD=18.
    const percentile = useMemo(() => {
        const z = (wpm - 45) / 18;
        // Approximation of CDF for normal distribution
        // Using a simple sigmoid-like approximation or error function if available, but simple is fine.
        // 1 / (1 + exp(-1.7 * z)) is a logistic approximation, close enough for this.
        const p = 1 / (1 + Math.exp(-1.6 * z));
        return Math.min(99, Math.max(1, Math.round(p * 100)));
    }, [wpm]);

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
                            {percentile}%
                        </Text>
                        <Text fontSize="xl" color="var(--text-subtle)">faster than others</Text>
                    </Box>
                    <Box textAlign="center">
                        <Text fontSize="6xl" fontWeight={700} color="var(--text)" lineHeight={1}>
                            {Math.round(wpm)}
                        </Text>
                        <Text fontSize="xl" color="var(--text-subtle)">wpm</Text>
                    </Box>
                </MotionFlex>

                <MotionFlex gap={2} flexWrap="wrap" justify="center" {...itemProps}>
                    {meta.map((item) => (
                        <MetaPill key={item.label} label={item.label} value={item.value} />
                    ))}
                </MotionFlex>

                {/* Graph */}
                <MotionBox h="300px" w="100%" {...itemProps}>
                    <ResultGraph data={history} height={300} />
                </MotionBox>

                {/* Detailed Stats */}
                <MotionFlex gap={8} flexWrap="wrap" justify="center" {...itemProps}>
                    <StatBox label="Raw" value={Math.round(wpm / accuracy || wpm).toString()} />
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

function MetaPill({ label, value }: { label: string; value: string }) {
    return (
        <Flex
            align="center"
            gap={2}
            px={3}
            py={1.5}
            borderRadius="full"
            border="1px solid var(--border)"
            bg="var(--surface)"
        >
            <Text fontSize="xs" color="var(--text-subtle)" textTransform="uppercase" letterSpacing="0.1em">
                {label}
            </Text>
            <Badge colorScheme="yellow" variant="subtle" px={2} py={0.5} borderRadius="full">
                {value}
            </Badge>
        </Flex>
    );
}
