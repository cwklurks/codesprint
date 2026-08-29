"use client";

import { memo, useEffect, useRef, useState } from "react";
import { Box, Flex, Text } from "@chakra-ui/react";

type LiveStatsProps = {
    wpm: number | null;
    accuracy: number;
    label?: string;
};

/**
 * Metrics update several times a second. Announcing every one turns a screen
 * reader into a metronome, so the live region publishes at most this often
 * (leading edge, then trailing edge so the latest value always lands).
 */
const ANNOUNCE_INTERVAL_MS = 5_000;

function LiveStats({ wpm, accuracy, label = "Live WPM" }: LiveStatsProps) {
    const roundedWpm = wpm == null ? null : Math.max(0, Math.round(wpm));
    const roundedAccuracy = Math.round(accuracy * 100);

    const [announcement, setAnnouncement] = useState("");
    const lastAnnouncedAt = useRef(0);

    useEffect(() => {
        if (roundedWpm == null) return;

        const publish = () => {
            lastAnnouncedAt.current = Date.now();
            setAnnouncement(`${roundedWpm} words per minute, ${roundedAccuracy} percent accuracy`);
        };

        const waitMs = ANNOUNCE_INTERVAL_MS - (Date.now() - lastAnnouncedAt.current);
        if (waitMs <= 0) {
            publish();
            return;
        }

        const timer = setTimeout(publish, waitMs);
        return () => clearTimeout(timer);
    }, [roundedWpm, roundedAccuracy]);

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
            <Flex justify="space-between" align="baseline" aria-hidden="true">
                <Text fontSize="2xl" fontWeight={700} fontVariantNumeric="tabular-nums">
                    {roundedWpm ?? "—"}
                </Text>
                <Text fontSize="2xl" fontWeight={700} fontVariantNumeric="tabular-nums">
                    {roundedAccuracy}%
                </Text>
            </Flex>
            <Box srOnly aria-live="polite" aria-atomic="true">
                {announcement}
            </Box>
        </Box>
    );
}

export default memo(LiveStats);
