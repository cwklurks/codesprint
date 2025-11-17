"use client";

import { Box, Flex, Text } from "@chakra-ui/react";

type LiveStatsProps = {
    wpm: number | null;
    acc: number;
    label?: string;
};

export default function LiveStats({ wpm, acc, label = "Live WPM" }: LiveStatsProps) {
    return (
        <Box
            borderRadius="16px"
            border="1px solid var(--border)"
            bg="var(--panel-glass)"
            backdropFilter="blur(12px)"
            px={6}
            py={4}
            minW="260px"
            color="var(--text)"
        >
            <Flex justify="space-between" fontSize="sm" color="var(--text-subtle)" mb={1}>
                <Text>{label}</Text>
                <Text>Accuracy</Text>
            </Flex>
            <Flex justify="space-between" align="baseline">
                <Text fontSize="2xl" fontWeight={700}>
                    {wpm == null ? "—" : Math.max(0, Math.round(wpm))}
                </Text>
                <Text fontSize="2xl" fontWeight={700}>
                    {(acc * 100).toFixed(0)}%
                </Text>
            </Flex>
        </Box>
    );
}
