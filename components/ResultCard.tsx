"use client";

import { Badge, Box, Button, Flex, Stack, Text, chakra } from "@chakra-ui/react";
import type { IconProps as ChakraIconProps } from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { m } from "framer-motion";
import type { Variants } from "framer-motion";
import ResultGraph, { type ResultGraphPoint } from "./ResultGraph";
import type { Token } from "@/lib/tokenizer";
import type { WeakPattern } from "@/lib/pattern-analysis";
import { analyzeWeakPatterns } from "@/lib/pattern-analysis";
import { renderShareCard, shareCard, downloadCanvas, type ShareCardData } from "@/lib/share-card";
import { computePercentile } from "@/lib/percentile";
import { bestDelta } from "@/lib/personal-best";
import { MOTION_EASE, usePrefersReducedMotion } from "@/lib/motion";

const MotionBox = m.create(Box);
const MotionFlex = m.create(Flex);

/**
 * The result screen is the emotional beat of a run, so the card reveals in one
 * short choreographed sequence instead of a single flat fade: sections cascade
 * ~60 ms apart while the WPM hero counts up. Everything below is gated on
 * `prefers-reduced-motion` and settles well under a second.
 */
const SECTION_STAGGER = 0.06;

const CARD_SECTIONS: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: SECTION_STAGGER, delayChildren: 0.04 } },
};

const CARD_SECTION: Variants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.32, ease: MOTION_EASE.out },
    },
};

/** Spring shared by the NEW BEST badge and the achievement pills below the card. */
export const RESULT_POP_SPRING = { type: "spring", stiffness: 320, damping: 18 } as const;

const COUNT_UP_MS = 620;

type ErrorEntry = { expected: string; got: string; index: number };

type ResultCardProps = {
    wpm: number;
    rawWpm: number;
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
    priorBestWpm?: number;
    isNewBest?: boolean;
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

/**
 * Counts from 0 to `value` on rAF, landing on the exact integer (never a lerp
 * artifact). Isolated in its own component so the ~40 frames of state churn
 * never re-render the card, the graph, or the action buttons.
 */
function CountUpNumber({ value, animate }: { value: number; animate: boolean }) {
    const [displayed, setDisplayed] = useState(() => (animate ? 0 : value));

    useEffect(() => {
        if (!animate) {
            setDisplayed(value);
            return;
        }
        let start: number | null = null;
        let frame = 0;
        const step = (now: number) => {
            if (start === null) start = now;
            const t = Math.min(1, (now - start) / COUNT_UP_MS);
            // easeOutCubic, then snap to the exact final value on the last frame.
            setDisplayed(t >= 1 ? value : Math.round(value * (1 - Math.pow(1 - t, 3))));
            if (t < 1) frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
        return () => cancelAnimationFrame(frame);
    }, [value, animate]);

    return (
        <Box
            as="span"
            data-testid="result-wpm"
            display="inline-block"
            // Reserve the final digit count so the hero never reflows mid-count.
            minW={`${String(value).length}ch`}
            fontVariantNumeric="tabular-nums"
        >
            {displayed}
        </Box>
    );
}


export default function ResultCard({
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
    onNext,
    autoAdvanceDeadline,
    patternScore,
    tokens,
    contentLength,
    isAIDrill,
    priorBestWpm,
    isNewBest,
}: ResultCardProps) {
    const prefersReducedMotion = usePrefersReducedMotion() ?? false;
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
        rawWpm,
        accuracy,
        patternScore,
        snippetTitle: snippetTitle || snippetId,
        language,
        difficulty,
        timeMs,
        history: history.map((h) => ({ time: h.time, wpm: h.wpm })),
        bestWpm: priorBestWpm,
        isNewBest,
    }), [wpm, rawWpm, accuracy, patternScore, snippetTitle, snippetId, language, difficulty, timeMs, history, priorBestWpm, isNewBest]);

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
    // Shared with the share card (lib/percentile.ts) so both surfaces agree.
    const percentile = useMemo(() => computePercentile(wpm), [wpm]);

    const pbDelta = useMemo(() => bestDelta(wpm, priorBestWpm), [wpm, priorBestWpm]);
    // A subtle "best" line only makes sense when we have a real prior best to beat.
    const showPriorBest = !isNewBest && priorBestWpm !== undefined && priorBestWpm > 0;

    const containerMotion = prefersReducedMotion
        ? {}
        : { variants: CARD_SECTIONS, initial: "hidden" as const, animate: "visible" as const };
    const sectionMotion = prefersReducedMotion ? {} : { variants: CARD_SECTION };

    return (
        <MotionBox
            {...containerMotion}
            borderRadius="var(--radius-xl)"
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
                    {...sectionMotion}
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
                            <Text
                                fontSize="4xl"
                                fontWeight={700}
                                color="var(--accent)"
                                lineHeight={1}
                                fontVariantNumeric="tabular-nums"
                            >
                                {percentile}%
                            </Text>
                            <Text fontSize="md" color="var(--text-subtle)" mt={1}>faster than peers</Text>
                        </Box>
                    </Flex>
                    <Box textAlign="center" px={{ md: 8 }}>
                        <Text fontSize="8xl" fontWeight={800} color="var(--text)" lineHeight={1}>
                            <CountUpNumber value={Math.round(wpm)} animate={!prefersReducedMotion} />
                        </Text>
                        <Text fontSize="md" color="var(--text-subtle)" mt={1}>wpm</Text>
                        {isNewBest ? (
                            <MotionFlex
                                align="center"
                                justify="center"
                                gap={1.5}
                                mt={3}
                                mx="auto"
                                w="fit-content"
                                px={3}
                                py={1}
                                borderRadius="full"
                                bg="var(--accent)"
                                color="var(--bg)"
                                {...(prefersReducedMotion
                                    ? {}
                                    : {
                                          initial: { opacity: 0, scale: 0.8 },
                                          animate: { opacity: 1, scale: 1 },
                                          transition: { ...RESULT_POP_SPRING, delay: 0.32 },
                                      })}
                            >
                                <Text fontSize="xs" fontWeight={800} letterSpacing="0.08em">
                                    NEW BEST
                                </Text>
                                {pbDelta > 0 && (
                                    <Text fontSize="xs" fontWeight={800} fontVariantNumeric="tabular-nums">
                                        +{pbDelta}
                                    </Text>
                                )}
                            </MotionFlex>
                        ) : showPriorBest ? (
                            <Text fontSize="xs" color="var(--text-subtle)" mt={2} fontVariantNumeric="tabular-nums">
                                best: {Math.round(priorBestWpm!)}
                            </Text>
                        ) : null}
                    </Box>
                    <Flex flex={{ md: "1 1 0" }} justify={{ base: "center", md: "flex-start" }}>
                        {patternScore !== undefined ? (
                            <Box textAlign="center">
                                <Text
                                    fontSize="4xl"
                                    fontWeight={700}
                                    color="var(--accent)"
                                    lineHeight={1}
                                    fontVariantNumeric="tabular-nums"
                                >
                                    {patternScore}
                                </Text>
                                <Text fontSize="md" color="var(--text-subtle)" mt={1}>syntax score</Text>
                            </Box>
                        ) : (
                            <Box aria-hidden />
                        )}
                    </Flex>
                </MotionFlex>

                <MotionFlex {...sectionMotion} gap={2} flexWrap="wrap" justify="center" mt={5}>
                    {meta.map((item) => (
                        <MetaPill key={item.label} label={item.label} value={item.value} />
                    ))}
                    {isAIDrill && (
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
                    )}
                </MotionFlex>

                {/* Graph */}
                <MotionBox {...sectionMotion} h="300px" w="100%" mt={8} py={2}>
                    <ResultGraph data={history} height={300} />
                </MotionBox>

                {/* Detailed Stats */}
                <MotionBox {...sectionMotion} w="100%" maxW="720px" mx="auto" mt={6}>
                    <Box
                        display="grid"
                        gridTemplateColumns={{ base: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }}
                        columnGap={{ base: 4, md: 6 }}
                        rowGap={4}
                    >
                        <StatBox label="Raw" value={Math.round(rawWpm).toString()} />
                        <StatBox label="Accuracy" value={`${Math.round(accuracy * 100)}%`} />
                        <StatBox label="Characters" value={`${(contentLength ?? 0) - errors}/${errors}`} helper="correct/uncorrected" />
                        <StatBox label="Time" value={formatDuration(timeMs)} />
                    </Box>
                </MotionBox>

                {/* Weak Patterns */}
                {weakPatterns.length > 0 && (
                    <MotionBox {...sectionMotion} textAlign="center" mt={8}>
                        <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.08em" color="var(--text-subtle)" mb={3}>
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
                                    borderRadius="var(--radius-sm)"
                                    border="1px solid var(--border)"
                                >
                                    <Text fontWeight="bold" fontSize="sm">{pattern.label}</Text>
                                    <Text fontSize="xs" color="var(--error)" fontVariantNumeric="tabular-nums">{pattern.errorCount} errors</Text>
                                </Flex>
                            ))}
                        </Flex>
                    </MotionBox>
                )}

                {/* Most Mistaken */}
                {mostMistaken.length > 0 && (
                    <MotionBox {...sectionMotion} textAlign="center" mt={8}>
                        <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.08em" color="var(--text-subtle)" mb={3}>
                            Most Mistaken (all attempts)
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
                                    borderRadius="var(--radius-sm)"
                                    border="1px solid var(--border)"
                                >
                                    <Text fontWeight="bold" fontFamily="var(--font-mono), monospace">{char}</Text>
                                    <Text fontSize="xs" color="var(--error)" fontVariantNumeric="tabular-nums">{count}</Text>
                                </Flex>
                            ))}
                        </Flex>
                    </MotionBox>
                )}

                {/* Actions */}
                <MotionFlex {...sectionMotion} gap={3} flexWrap="wrap" justify="center" mt={8} pt={5} borderTop="1px solid var(--border)">
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

                <MotionBox {...sectionMotion}>
                    {onNext && (
                        <Text textAlign="center" fontSize="xs" color="var(--text-subtle)" mt={4}>
                            Press Q, Escape, Tab, or Space to go to the next problem
                        </Text>
                    )}

                    {countdown !== null && countdown > 0 && (
                        <Text
                            textAlign="center"
                            fontSize="xs"
                            color="var(--text-subtle)"
                            mt={2}
                            fontVariantNumeric="tabular-nums"
                        >
                            Auto-advancing in {countdown}s…
                        </Text>
                    )}
                </MotionBox>
            </Stack>
        </MotionBox>
    );
}

function StatBox({ label, value, helper }: { label: string; value: string; helper?: string }) {
    return (
        <Box textAlign="center" minW={0}>
            <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.08em" color="var(--text-subtle)">
                {label}
            </Text>
            <Text fontSize="3xl" fontWeight={700} lineHeight={1.2} fontVariantNumeric="tabular-nums">
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
            <Text fontSize="xs" color="var(--text-subtle)" textTransform="uppercase" letterSpacing="0.08em">
                {label}
            </Text>
            <Badge bg="var(--surface-active)" color="var(--accent)" variant="subtle" px={2} py={0.5} borderRadius="full">
                {value}
            </Badge>
        </Flex>
    );
}
