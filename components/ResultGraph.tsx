"use client";

import { Box, Flex, Stack, Text } from "@chakra-ui/react";
import { useMemo, useState } from "react";

export type ResultGraphPoint = {
    time: number;
    wpm: number;
    raw: number;
    errors: number;
    burst: number;
};

type ResultGraphProps = {
    data: ResultGraphPoint[];
    width?: number | string;
    height?: number | string;
};

export default function ResultGraph({ data, width = "100%", height = 300 }: ResultGraphProps) {
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);

    const processedData = useMemo(() => {
        if (data.length === 0) return [];
        // Ensure we start at 0
        return [{ time: 0, wpm: 0, raw: 0, errors: 0, burst: 0 }, ...data];
    }, [data]);

    if (processedData.length < 2) {
        return (
            <Flex justify="center" align="center" h={height} w={width} bg="var(--surface)" borderRadius="lg" border="1px solid var(--border)">
                <Text color="var(--text-subtle)">Not enough data for graph</Text>
            </Flex>
        );
    }

    const maxWpm = Math.max(...processedData.map((d) => Math.max(d.raw, d.burst)), 60); // Minimum scale of 60
    const duration = processedData[processedData.length - 1].time;

    const padding = { top: 20, right: 20, bottom: 30, left: 40 };
    const graphWidth = 800; // Internal coordinate system width
    const graphHeight = 300; // Internal coordinate system height
    const innerWidth = graphWidth - padding.left - padding.right;
    const innerHeight = graphHeight - padding.top - padding.bottom;

    const getX = (time: number) => padding.left + (time / duration) * innerWidth;
    const getY = (val: number, max: number) => padding.top + innerHeight - (val / max) * innerHeight;

    const wpmPath = processedData
        .map((d, i) => {
            const x = getX(d.time);
            const y = getY(d.wpm, maxWpm);
            return `${i === 0 ? "M" : "L"} ${x},${y}`;
        })
        .join(" ");

    const rawPath = processedData
        .map((d, i) => {
            const x = getX(d.time);
            const y = getY(d.raw, maxWpm);
            return `${i === 0 ? "M" : "L"} ${x},${y}`;
        })
        .join(" ");

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (processedData.length < 2) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;

        // Scale x to SVG coordinate system
        // viewBox width is graphWidth (800)
        const svgX = x * (graphWidth / rect.width);

        const rawTime = ((svgX - padding.left) / innerWidth) * duration;

        // Find closest data point
        let closestIndex = 0;
        let minDiff = Number.MAX_VALUE;

        processedData.forEach((d, i) => {
            const diff = Math.abs(d.time - rawTime);
            if (diff < minDiff) {
                minDiff = diff;
                closestIndex = i;
            }
        });

        setHoverIndex(closestIndex);
    };

    return (
        <Box
            w={width}
            h={height}
            position="relative"
            userSelect="none"
        >
            <svg
                viewBox={`0 0 ${graphWidth} ${graphHeight}`}
                style={{ width: "100%", height: "100%", overflow: "visible" }}
                pointerEvents="none"
            >
                {/* Grid Lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                    const y = padding.top + innerHeight * (1 - t);
                    return (
                        <g key={t}>
                            <line x1={padding.left} y1={y} x2={graphWidth - padding.right} y2={y} stroke="var(--border)" strokeDasharray="4 4" />
                            <text x={padding.left - 10} y={y + 4} textAnchor="end" fontSize="10" fill="var(--text-subtle)">
                                {Math.round(maxWpm * t)}
                            </text>
                        </g>
                    );
                })}

                {/* Raw WPM Line */}
                <path
                    d={rawPath}
                    fill="none"
                    stroke="var(--text-subtle)"
                    strokeWidth="2"
                    strokeDasharray="5 5"
                    opacity="0.5"
                />

                {/* Net WPM Line */}
                <path
                    d={wpmPath}
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="3"
                />

                {/* Error Markers */}
                {processedData.map((d, i) => {
                    if (d.errors === 0) return null;
                    const x = getX(d.time);
                    const y = getY(d.wpm, maxWpm); // Place on WPM line
                    return (
                        <text key={i} x={x} y={y - 10} textAnchor="middle" fontSize="12" fill="var(--error)" fontWeight="bold">
                            ×
                        </text>
                    );
                })}

                {/* Active Point Indicator */}
                {hoverIndex !== null && (
                    <g>
                        <line
                            x1={getX(processedData[hoverIndex].time)}
                            y1={padding.top}
                            x2={getX(processedData[hoverIndex].time)}
                            y2={graphHeight - padding.bottom}
                            stroke="var(--text)"
                            strokeWidth="1"
                            opacity="0.5"
                        />
                        <circle
                            cx={getX(processedData[hoverIndex].time)}
                            cy={getY(processedData[hoverIndex].wpm, maxWpm)}
                            r="4"
                            fill="var(--bg)"
                            stroke="var(--accent)"
                            strokeWidth="2"
                        />
                    </g>
                )}
            </svg>

            {/* Interaction Overlay */}
            <Box
                position="absolute"
                inset={0}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHoverIndex(null)}
                cursor="crosshair"
                zIndex={5}
            />

            {/* Tooltip */}
            {hoverIndex !== null && processedData[hoverIndex] && (
                <Box
                    position="absolute"
                    left={`${(getX(processedData[hoverIndex].time) / graphWidth) * 100}%`}
                    top="0"
                    transform="translate(-50%, -110%)"
                    bg="#111"
                    border="1px solid #333"
                    color="#eee"
                    p={2}
                    borderRadius="md"
                    fontSize="xs"
                    boxShadow="xl"
                    pointerEvents="none"
                    whiteSpace="nowrap"
                    zIndex={20}
                    minW="120px"
                >
                    <Text fontWeight="bold" mb={1} borderBottom="1px solid #333" pb={1}>
                        Time: {processedData[hoverIndex].time}s
                    </Text>
                    <Stack gap={1}>
                        <Flex align="center" justify="space-between" gap={3}>
                            <Flex align="center" gap={2}>
                                <Box w={2} h={2} bg="var(--error)" borderRadius="sm" />
                                <Text opacity={0.8}>errors:</Text>
                            </Flex>
                            <Text fontWeight="bold">{processedData[hoverIndex].errors}</Text>
                        </Flex>
                        <Flex align="center" justify="space-between" gap={3}>
                            <Flex align="center" gap={2}>
                                <Box w={2} h={2} bg="var(--accent)" borderRadius="sm" />
                                <Text opacity={0.8}>wpm:</Text>
                            </Flex>
                            <Text fontWeight="bold">{processedData[hoverIndex].wpm}</Text>
                        </Flex>
                        <Flex align="center" justify="space-between" gap={3}>
                            <Flex align="center" gap={2}>
                                <Box w={2} h={2} bg="var(--text-subtle)" borderRadius="sm" />
                                <Text opacity={0.8}>raw:</Text>
                            </Flex>
                            <Text fontWeight="bold">{processedData[hoverIndex].raw}</Text>
                        </Flex>
                        <Flex align="center" justify="space-between" gap={3}>
                            <Flex align="center" gap={2}>
                                <Box w={2} h={2} bg="var(--text-subtle)" borderRadius="sm" opacity={0.5} />
                                <Text opacity={0.8}>burst:</Text>
                            </Flex>
                            <Text fontWeight="bold">{processedData[hoverIndex].burst}</Text>
                        </Flex>
                    </Stack>
                </Box>
            )}
        </Box>
    );
}
