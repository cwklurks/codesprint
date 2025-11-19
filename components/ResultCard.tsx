"use client";

import { Box, Button, Flex, Stack, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { usePrefersReducedMotion } from "@/lib/motion";

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
};

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
            p={{ base: 5, md: 6 }}
            w="100%"
            maxW="800px"
            {...animationProps}
        >
            <Stack gap={6}>
                <MotionBox {...itemProps}>
                    <Text fontSize="sm" color="var(--text-subtle)">
                        Completed snippet
                    </Text>
                    <Text fontSize="xl" fontWeight={600}>
                        {snippetTitle} <Text as="span" color="var(--text-subtle)">#{snippetId}</Text>
                    </Text>
                    <Text fontSize="sm" color="var(--text-subtle)">
                        {lang.toUpperCase()} • {difficulty} • {lengthCategory}
                    </Text>
                </MotionBox>

                <MotionFlex gap={4} flexWrap="wrap" {...itemProps}>
                    <Stat label="Adjusted WPM" value={`${Math.round(wpm)}`} />
                    <Stat label="Accuracy" value={`${(acc * 100).toFixed(1)}%`} />
                    <Stat label="Duration" value={formatDuration(timeMs)} />
                    <Stat label="Errors" value={errors.toString()} />
                </MotionFlex>

                {errorLog.length > 0 && (
                    <MotionStack gap={1} {...itemProps}>
                        <Text fontSize="sm" fontWeight={600}>
                            Recent mistakes
                        </Text>
                        {errorLog.slice(-5).map((entry, index) => (
                            <Text key={`${entry.index}-${index}`} fontSize="xs" color="var(--text-subtle)">
                                #{entry.index}: expected <strong>{JSON.stringify(entry.expected)}</strong> got{" "}
                                <strong>{JSON.stringify(entry.got)}</strong>
                            </Text>
                        ))}
                    </MotionStack>
                )}

                <MotionFlex gap={3} flexWrap="wrap" align="center" {...itemProps}>
                    <Button onClick={onReplay} colorScheme="yellow">
                        Replay
                    </Button>
                    {onNext && (
                        <Button onClick={onNext} variant="outline" borderColor="var(--border)">
                            Next problem
                        </Button>
                    )}
                    {countdown !== null && countdown > 0 && (
                        <Text fontSize="xs" color="var(--text-subtle)" ml={2}>
                            Auto-advancing in {countdown}s…
                        </Text>
                    )}
                </MotionFlex>
            </Stack>
        </MotionBox>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <Box flex="1 1 140px" minW="140px">
            <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.1em" color="var(--text-subtle)">
                {label}
            </Text>
            <Text fontSize="2xl" fontWeight={700}>
                {value}
            </Text>
        </Box>
    );
}
