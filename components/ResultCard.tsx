"use client";

import { Badge, Box, Button, Flex, Stack, Text, chakra } from "@chakra-ui/react";
import type { IconProps as ChakraIconProps } from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
const MotionBox = motion(Box);
const MotionFlex = motion(Flex);
import ResultGraph, { type ResultGraphPoint } from "./ResultGraph";
import type { Token } from "@/lib/tokenizer";
import type { WeakPattern } from "@/lib/pattern-analysis";
import { analyzeWeakPatterns } from "@/lib/pattern-analysis";
import { renderShareCard, shareCard, downloadCanvas, type ShareCardData } from "@/lib/share-card";

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
    onNext?: () => void;
    autoAdvanceDeadline: number | null;
    history: ResultGraphPoint[];
    patternScore?: number;
    tokens?: Token[];
    contentLength?: number;
    isAIDrill?: boolean;
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
    onNext,
    autoAdvanceDeadline,
    patternScore,
    tokens,
    contentLength,
    isAIDrill,
}: ResultCardProps) {
    const [countdown, setCountdown] = useState<number | null>(null);
    const [isSharing, setIsSharing] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

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

    const weakPatterns: WeakPattern[] = useMemo(() => {
        if (!tokens || !contentLength) return [];
        return analyzeWeakPatterns(errorLog, tokens, contentLength, language);
    }, [errorLog, tokens, contentLength, language]);

    const shareCardData: ShareCardData = useMemo(() => ({
        wpm,
        accuracy,
        patternScore,
        snippetTitle: snippetTitle || snippetId,
        language,
        difficulty,
        timeMs,
        history: history.map((h) => ({ time: h.time, wpm: h.wpm })),
    }), [wpm, accuracy, patternScore, snippetTitle, snippetId, language, difficulty, timeMs, history]);

    const handleShare = useCallback(async () => {
        setIsSharing(true);
        try {
            const canvas = await renderShareCard(shareCardData);
            await shareCard(canvas, shareCardData);
        } finally {
            setIsSharing(false);
        }
    }, [shareCardData]);

    const handleDownload = useCallback(async () => {
        setIsDownloading(true);
        try {
            const canvas = await renderShareCard(shareCardData);
            downloadCanvas(canvas);
        } finally {
            setIsDownloading(false);
        }
    }, [shareCardData]);

    const meta = useMemo(
        () => [
            { label: "Problem", value: snippetTitle || snippetId },
            { label: "Language", value: language.toUpperCase() },
            { label: "Difficulty", value: capitalize(difficulty) },
            { label: "Length", value: capitalize(lengthCategory) },
        ],
        [difficulty, language, lengthCategory, snippetId, snippetTitle]
    );

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
        >
            <Stack gap={0}>
                {/* Header */}
                <MotionFlex
                    w="100%"
                    maxW="900px"
                    mx="auto"
                    align={{ base: "center", md: "flex-end" }}
                    justify="center"
                    flexDirection={{ base: "column", md: "row" }}
                    gap={{ base: 6, md: 0 }}
                >
                    <Flex flex={{ md: "1 1 0" }} justify={{ base: "center", md: "flex-end" }}>
                        <Box textAlign="center">
                            <Text fontSize="4xl" fontWeight={700} color="var(--accent)" lineHeight={1}>
                                {percentile}%
                            </Text>
                            <Text fontSize="md" color="var(--text-subtle)" mt={1}>faster than others</Text>
                        </Box>
                    </Flex>
                    <Box textAlign="center" px={{ md: 8 }}>
                        <Text fontSize="8xl" fontWeight={800} color="var(--text)" lineHeight={1}>
                            {Math.round(wpm)}
                        </Text>
                        <Text fontSize="md" color="var(--text-subtle)" mt={1}>wpm</Text>
                    </Box>
                    <Flex flex={{ md: "1 1 0" }} justify={{ base: "center", md: "flex-start" }}>
                        {patternScore !== undefined ? (
                            <Box textAlign="center">
                                <Text fontSize="4xl" fontWeight={700} color="var(--accent)" lineHeight={1}>
                                    {patternScore}
                                </Text>
                                <Text fontSize="md" color="var(--text-subtle)" mt={1}>syntax score</Text>
                            </Box>
                        ) : (
                            <Box aria-hidden />
                        )}
                    </Flex>
                </MotionFlex>

                <MotionFlex gap={2} flexWrap="wrap" justify="center" mt={5}>
                    {meta.map((item) => (
                        <MetaPill key={item.label} label={item.label} value={item.value} />
                    ))}
                    {isAIDrill && (
                        <MotionBox
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.3 }}
                        >
                            <Flex
                                align="center"
                                gap={2}
                                px={3}
                                py={1.5}
                                borderRadius="full"
                                border="1px solid var(--border)"
                                bg="var(--surface)"
                            >
                                <chakra.svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    width={14}
                                    height={14}
                                    color="var(--accent)"
                                >
                                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                                </chakra.svg>
                                <Text fontSize="xs" color="var(--accent)" fontWeight={600}>
                                    AI
                                </Text>
                            </Flex>
                        </MotionBox>
                    )}
                </MotionFlex>

                {/* Graph */}
                <MotionBox h="300px" w="100%" mt={8} py={2}>
                    <ResultGraph data={history} height={300} />
                </MotionBox>

                {/* Detailed Stats */}
                <MotionBox w="100%" maxW="560px" mx="auto" mt={6}>
                    <Box
                        display="grid"
                        gridTemplateColumns="repeat(3, minmax(0, 1fr))"
                        columnGap={{ base: 4, md: 8 }}
                        rowGap={4}
                    >
                        <StatBox label="Raw" value={Math.round(accuracy > 0 ? wpm / accuracy : wpm).toString()} />
                        <StatBox label="Characters" value={`${(contentLength ?? 0) - errors}/${errors}`} helper="correct/incorrect" />
                        <StatBox label="Time" value={formatDuration(timeMs)} />
                    </Box>
                </MotionBox>

                {/* Weak Patterns */}
                {weakPatterns.length > 0 && (
                    <MotionBox textAlign="center" mt={8}>
                        <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.1em" color="var(--text-subtle)" mb={3}>
                            Weak Patterns
                        </Text>
                        <Flex gap={3} flexWrap="wrap" justify="center">
                            {weakPatterns.map((pattern) => (
                                <Flex
                                    key={pattern.category}
                                    align="center"
                                    gap={2}
                                    bg="var(--surface)"
                                    px={3}
                                    py={1.5}
                                    borderRadius="md"
                                    border="1px solid var(--border)"
                                >
                                    <Text fontWeight="bold" fontSize="sm">{pattern.label}</Text>
                                    <Text fontSize="xs" color="var(--error)">{pattern.errorCount} errors</Text>
                                </Flex>
                            ))}
                        </Flex>
                    </MotionBox>
                )}

                {/* Most Mistaken */}
                {mostMistaken.length > 0 && (
                    <MotionBox textAlign="center" mt={8}>
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
                <MotionFlex gap={3} flexWrap="wrap" justify="center" mt={8} pt={5} borderTop="1px solid var(--border)">
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
                    <Button
                        onClick={handleShare}
                        size="lg"
                        variant="outline"
                        borderColor="var(--border)"
                        color="var(--text-subtle)"
                        _hover={{ bg: "var(--surface-hover)", color: "var(--text)" }}
                        px={6}
                        disabled={isSharing}
                        opacity={isSharing ? 0.6 : 1}
                    >
                        <Flex align="center" gap={2}>
                            <ShareIcon boxSize={4} />
                            {isSharing ? "Sharing..." : "Share"}
                        </Flex>
                    </Button>
                    <Button
                        onClick={handleDownload}
                        size="lg"
                        variant="outline"
                        borderColor="var(--border)"
                        color="var(--text-subtle)"
                        _hover={{ bg: "var(--surface-hover)", color: "var(--text)" }}
                        px={6}
                        disabled={isDownloading}
                        opacity={isDownloading ? 0.6 : 1}
                    >
                        <Flex align="center" gap={2}>
                            <DownloadIcon boxSize={4} />
                            {isDownloading ? "Downloading..." : "Download"}
                        </Flex>
                    </Button>
                </MotionFlex>

                {onNext && (
                    <Text textAlign="center" fontSize="xs" color="var(--text-subtle)" mt={4}>
                        Press Q, Escape, Tab, or Space to go to the next page
                    </Text>
                )}

                {countdown !== null && countdown > 0 && (
                    <Text textAlign="center" fontSize="xs" color="var(--text-subtle)" mt={2}>
                        Auto-advancing in {countdown}s…
                    </Text>
                )}
            </Stack>
        </MotionBox>
    );
}

function StatBox({ label, value, helper }: { label: string; value: string; helper?: string }) {
    return (
        <Box textAlign="center" minW={0}>
            <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.1em" color="var(--text-subtle)">
                {label}
            </Text>
            <Text fontSize="3xl" fontWeight={700} lineHeight={1.2}>
                {value}
            </Text>
            <Text fontSize="xs" color="var(--text-subtle)" opacity={helper ? 0.7 : 0} minH="1rem">
                {helper ?? " "}
            </Text>
        </Box>
    );
}

function ShareIcon(props: ChakraIconProps) {
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
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
        </chakra.svg>
    );
}

function DownloadIcon(props: ChakraIconProps) {
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
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
        </chakra.svg>
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
            <Badge bg="var(--surface-active)" color="var(--accent)" variant="subtle" px={2} py={0.5} borderRadius="full">
                {value}
            </Badge>
        </Flex>
    );
}
