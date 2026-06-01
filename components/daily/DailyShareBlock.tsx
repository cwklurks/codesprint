"use client";

import { useCallback, useState } from "react";
import { Box, Button, Flex, Text } from "@chakra-ui/react";

import { formatDailyShare } from "@/lib/daily";

export interface DailyShareBlockProps {
    dateStr: string;
    dayNumber: number;
    wpm: number;
    accuracy: number;
    patternScore?: number;
    streak: number;
    language: string;
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
            setTimeout(() => setCopied(false), 1800);
        } catch (err) {
            console.warn("Failed to copy daily result", err);
        }
    }, [shareText]);

    return (
        <Flex direction="column" align="center" gap={3} w="100%" maxW="360px">
            <Box
                w="100%"
                bg="var(--surface)"
                border="1px solid var(--border)"
                borderRadius="md"
                px={4}
                py={3}
            >
                <Text
                    as="pre"
                    fontFamily="monospace"
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
            >
                {copied ? "Copied!" : "Copy result"}
            </Button>
        </Flex>
    );
}
