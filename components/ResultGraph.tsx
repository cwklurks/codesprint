"use client";

import { Box, Flex, Text } from "@chakra-ui/react";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";

export type ResultGraphPoint = {
    time: number;
    wpm: number;
    raw: number;
    errors: number;
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
        return [{ time: 0, wpm: 0, raw: 0, errors: 0 }, ...data];
    }, [data]);

    if (processedData.length < 2) {
        return (
            <Flex justify="center" align="center" h={height} w={width} bg="var(--surface)" borderRadius="lg" border="1px solid var(--border)">
                <Text color="var(--text-subtle)">Not enough data for graph</Text>
            </Flex>
        );
    }

    const maxWpm = Math.max(...processedData.map((d) => d.raw), 60); // Minimum scale of 60
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

    return (
        <Box w={width} h={height} position="relative" userSelect="none">
            <svg
                viewBox={`0 0 ${graphWidth} ${graphHeight}`}
                style={{ width: "100%", height: "100%", overflow: "visible" }}
                onMouseLeave={() => setHoverIndex(null)}
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
                <motion.path
                    d={rawPath}
                    fill="none"
                    stroke="var(--text-subtle)"
                    strokeWidth="2"
                    strokeDasharray="5 5"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 0.5 }}
                    transition={{ duration: 1, ease: "easeOut" }}
                />

                {/* Net WPM Line */}
                <motion.path
                    d={wpmPath}
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="3"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 1, ease: "easeOut" }}
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

                {/* Hover Overlay */}
                {/* Invisible rects for hover detection */}
                {processedData.map((d, i) => {
                    if (i === 0) return null;
                    const prev = processedData[i - 1];
                    const xStart = getX((prev.time + d.time) / 2);
                    const xEnd = i < processedData.length - 1
                        ? getX((d.time + processedData[i + 1].time) / 2)
                        : graphWidth - padding.right;

                    // For first point
                    const effectiveXStart = i === 1 ? padding.left : xStart;

                    return (
                        <rect
                            key={i}
                            x={effectiveXStart}
                            y={padding.top}
                            width={xEnd - effectiveXStart}
                            height={innerHeight}
                            fill="transparent"
                            onMouseEnter={() => setHoverIndex(i)}
                        />
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

            {/* Tooltip */}
            {hoverIndex !== null && (
                <Box
                    position="absolute"
                    left={`${(getX(processedData[hoverIndex].time) / graphWidth) * 100}%`}
                    top={`${(getY(processedData[hoverIndex].wpm, maxWpm) / graphHeight) * 100}%`}
                    transform="translate(-50%, -120%)"
                    bg="var(--tooltip-bg)"
                    color="var(--tooltip-fg)"
                    px={3}
                    py={2}
                    borderRadius="md"
                    fontSize="xs"
                    boxShadow="lg"
                    pointerEvents="none"
                    whiteSpace="nowrap"
                    zIndex={10}
                >
                    <Text fontWeight="bold">{processedData[hoverIndex].wpm} WPM</Text>
                    <Text opacity={0.8}>Raw: {processedData[hoverIndex].raw}</Text>
                    <Text opacity={0.8}>Errors: {processedData[hoverIndex].errors}</Text>
                    <Text opacity={0.6} fontSize="10px" mt={1}>Time: {processedData[hoverIndex].time}s</Text>
                </Box>
            )}
        </Box>
    );
}
