"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Button, Flex, Text, chakra } from "@chakra-ui/react";
import { AnimatePresence, m } from "framer-motion";

import { formatDailyShare } from "@/lib/daily";
import { MOTION_DURATION, MOTION_EASE, usePrefersReducedMotion } from "@/lib/motion";

export interface DailyShareBlockProps {
    dateStr: string;
    dayNumber: number;
    wpm: number;
    accuracy: number;
    patternScore?: number;
    streak: number;
    language: string;
}

const COPIED_RESET_MS = 1800;

/**
 * Streak flame. Lives here because both the daily card and the result screen
 * (which already import this module) need the same mark, and the app renders
 * icons as inline SVG rather than emoji.
 */
export function StreakFlame({ size = 16 }: { size?: number }) {
    return (
        <chakra.svg
            viewBox="0 0 24 24"
            width={size}
            height={size}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            color="var(--accent)"
            aria-hidden="true"
            flexShrink={0}
        >
            <path d="M12 2c1.5 3 4.5 4.5 4.5 8a4.5 4.5 0 0 1-9 0c0-1.2.4-2.1 1-3" />
            <path d="M12 22a6 6 0 0 0 6-6c0-2-1-3.5-2.5-5" />
            <path d="M12 22a6 6 0 0 1-6-6c0-2 1-3.5 2.5-5" />
        </chakra.svg>
    );
}

/**
 * Wordle-style copy-paste daily result block with a "Copy result" button.
 * No snippet contents are ever shown.
 */
export function DailyShareBlock({
    dateStr,
    dayNumber,
    wpm,
    accuracy,
    patternScore,
    streak,
    language,
}: DailyShareBlockProps) {
    const [copied, setCopied] = useState(false);
    const prefersReducedMotion = usePrefersReducedMotion() ?? false;
    const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => () => {
        if (resetTimer.current) clearTimeout(resetTimer.current);
    }, []);

    const shareText = formatDailyShare({
        dateStr,
        dayNumber,
        wpm,
        accuracy,
        patternScore,
        streak,
        language,
    });

    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(shareText);
            setCopied(true);
            if (resetTimer.current) clearTimeout(resetTimer.current);
            resetTimer.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
        } catch (err) {
            console.warn("Failed to copy daily result", err);
        }
    }, [shareText]);

    const swap = prefersReducedMotion
        ? {}
        : {
              initial: { opacity: 0, y: 6 },
              animate: { opacity: 1, y: 0 },
              exit: { opacity: 0, y: -6 },
              transition: { duration: MOTION_DURATION.micro, ease: MOTION_EASE.out },
          };

    return (
        <Flex direction="column" align="center" gap={3} w="100%" maxW="360px">
            <Box
                w="100%"
                bg="var(--surface)"
                border="1px solid var(--border)"
                borderRadius="var(--radius-md)"
                px={4}
                py={3}
            >
                <Text
                    as="pre"
                    fontFamily="var(--font-mono), monospace"
                    fontSize="sm"
                    color="var(--text)"
                    whiteSpace="pre-wrap"
                    textAlign="center"
                    m={0}
                >
                    {shareText}
                </Text>
            </Box>
            <Button
                onClick={handleCopy}
                size="md"
                variant="outline"
                borderColor="var(--accent)"
                color="var(--accent)"
                _hover={{ bg: "var(--accent)", color: "var(--bg)" }}
                px={6}
                // The label swaps in place; a fixed slot keeps the button from
                // jumping between "Copy result" and "Copied!".
                minW="9.5rem"
            >
                <Box as="span" position="relative" display="block" w="100%" textAlign="center">
                    <AnimatePresence initial={false} mode="wait">
                        <m.span key={copied ? "copied" : "copy"} style={{ display: "block" }} {...swap}>
                            {copied ? "Copied!" : "Copy result"}
                        </m.span>
                    </AnimatePresence>
                </Box>
            </Button>
        </Flex>
    );
}
