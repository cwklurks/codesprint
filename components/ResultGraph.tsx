"use client";

import { Box, Flex, Stack, Text } from "@chakra-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { m } from "framer-motion";

import { MOTION_DURATION, MOTION_EASE, usePrefersReducedMotion } from "@/lib/motion";

export type ResultGraphPoint = {
    time: number;
    /** Smooth net graph WPM snapshot, not the final strict adjusted WPM. */
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

/** Coordinate-system fallback used until the container has been measured. */
const FALLBACK_WIDTH = 800;
const GRAPH_HEIGHT = 300;
const PADDING = { top: 20, right: 20, bottom: 30, left: 40 };
/** Lines start drawing as the graph section reaches its slot in the card cascade. */
const DRAW_ON_DELAY = 0.16;
const DRAW_ON_DURATION = 0.55;

export default function ResultGraph({ data, width = "100%", height = 300 }: ResultGraphProps) {
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);
    const prefersReducedMotion = usePrefersReducedMotion() ?? false;
    const containerRef = useRef<HTMLDivElement>(null);
    // The SVG user-unit system is pinned to the rendered CSS width so the plot
    // fills its card edge to edge (a fixed viewBox letterboxed it) and neither
    // strokes nor labels are ever scaled non-uniformly.
    const [measuredWidth, setMeasuredWidth] = useState(0);

    const processedData = useMemo(() => {
        if (data.length === 0) return [];
        // Ensure we start at 0
        return [{ time: 0, wpm: 0, raw: 0, errors: 0, burst: 0 }, ...data];
    }, [data]);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        setMeasuredWidth(el.getBoundingClientRect().width);
        if (typeof ResizeObserver === "undefined") return;
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) setMeasuredWidth(entry.contentRect.width);
        });
        observer.observe(el);
        return () => observer.disconnect();
        // Re-runs when the placeholder swaps for the real plot, which is when
        // the measured container first exists.
    }, [processedData.length]);

    if (processedData.length < 2) {
        return (
            <Flex
                justify="center"
                align="center"
                h={height}
                w={width}
                bg="var(--surface)"
                borderRadius="var(--radius-md)"
                border="1px solid var(--border)"
            >
                <Text color="var(--text-subtle)">Not enough data for graph</Text>
            </Flex>
        );
    }

    const rawMax = processedData.reduce((max, d) => Math.max(max, d.raw, d.burst), 60);
    const maxWpm = Math.ceil(rawMax / 20) * 20;
    const duration = processedData[processedData.length - 1].time;

    const graphWidth = measuredWidth > 0 ? measuredWidth : FALLBACK_WIDTH;
    const graphHeight = GRAPH_HEIGHT;
    const innerWidth = graphWidth - PADDING.left - PADDING.right;
    const innerHeight = graphHeight - PADDING.top - PADDING.bottom;

    const getX = (time: number) => PADDING.left + (time / duration) * innerWidth;
    const getY = (val: number, max: number) => PADDING.top + innerHeight - (val / max) * innerHeight;

    const toPath = (value: (point: ResultGraphPoint) => number) =>
        processedData
            .map((d, i) => `${i === 0 ? "M" : "L"} ${getX(d.time)},${getY(value(d), maxWpm)}`)
            .join(" ");

    const wpmPath = toPath((d) => d.wpm);
    const rawPath = toPath((d) => d.raw);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        if (rect.width === 0) return;
        // SVG user units track CSS pixels, so this is a straight rescale.
        const svgX = (e.clientX - rect.left) * (graphWidth / rect.width);
        const rawTime = ((svgX - PADDING.left) / innerWidth) * duration;

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

    const hovered = hoverIndex !== null ? processedData[hoverIndex] : null;
    const hoverX = hovered ? getX(hovered.time) : 0;
    const hoverY = hovered ? getY(hovered.wpm, maxWpm) : 0;
    const crosshairTransition = prefersReducedMotion
        ? { duration: 0 }
        : { duration: MOTION_DURATION.micro, ease: MOTION_EASE.out };

    return (
        <Box ref={containerRef} w={width} h={height} position="relative" userSelect="none">
            <svg
                viewBox={`0 0 ${graphWidth} ${graphHeight}`}
                style={{ width: "100%", height: "100%", overflow: "visible" }}
                pointerEvents="none"
            >
                {/* Grid Lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                    const y = PADDING.top + innerHeight * (1 - t);
                    return (
                        <g key={t}>
                            <line x1={PADDING.left} y1={y} x2={graphWidth - PADDING.right} y2={y} stroke="var(--border)" strokeDasharray="4 4" />
                            <text x={PADDING.left - 10} y={y + 4} textAnchor="end" fontSize="10" fill="var(--text-subtle)">
                                {Math.round(maxWpm * t)}
                            </text>
                        </g>
                    );
                })}

                {/* Raw WPM Line. Dashed, so it fades in rather than drawing on
                    (pathLength would fight the dash pattern). */}
                <m.path
                    d={rawPath}
                    fill="none"
                    stroke="var(--text-subtle)"
                    strokeWidth="2"
                    strokeDasharray="5 5"
                    initial={prefersReducedMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 0.5 }}
                    transition={{
                        duration: MOTION_DURATION.base,
                        ease: MOTION_EASE.out,
                        delay: DRAW_ON_DELAY + DRAW_ON_DURATION * 0.5,
                    }}
                />

                {/* Net graph WPM line, drawn on left to right. */}
                <m.path
                    d={wpmPath}
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={prefersReducedMotion ? false : { pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: DRAW_ON_DURATION, ease: MOTION_EASE.out, delay: DRAW_ON_DELAY }}
                />

                {/* Error markers, settling once the line has drawn past them. */}
                <m.g
                    initial={prefersReducedMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{
                        duration: MOTION_DURATION.micro,
                        ease: MOTION_EASE.out,
                        delay: DRAW_ON_DELAY + DRAW_ON_DURATION,
                    }}
                >
                    {processedData.map((d, i) =>
                        d.errors === 0 ? null : (
                            <circle
                                key={i}
                                cx={getX(d.time)}
                                cy={getY(d.wpm, maxWpm) - 10}
                                r={3}
                                fill="var(--error)"
                            />
                        ),
                    )}
                </m.g>

                {/* Active Point Indicator */}
                {hovered && (
                    <g>
                        <m.line
                            initial={false}
                            animate={{ x1: hoverX, x2: hoverX }}
                            transition={crosshairTransition}
                            y1={PADDING.top}
                            y2={graphHeight - PADDING.bottom}
                            stroke="var(--text)"
                            strokeWidth="1"
                            opacity="0.5"
                        />
                        <m.circle
                            initial={false}
                            animate={{ cx: hoverX, cy: hoverY }}
                            transition={crosshairTransition}
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
            {hovered && (
                <Box
                    position="absolute"
                    left={`${(hoverX / graphWidth) * 100}%`}
                    top="0"
                    transform="translate(-50%, -110%)"
                    bg="var(--terminal-bg)"
                    border="1px solid var(--border)"
                    color="var(--text)"
                    p={2}
                    borderRadius="var(--radius-sm)"
                    fontSize="xs"
                    boxShadow="var(--elev-2)"
                    pointerEvents="none"
                    whiteSpace="nowrap"
                    zIndex={20}
                    minW="120px"
                    fontVariantNumeric="tabular-nums"
                >
                    <Text fontWeight="bold" mb={1} borderBottom="1px solid var(--border)" pb={1}>
                        Time: {hovered.time}s
                    </Text>
                    <Stack gap={1}>
                        <TooltipRow color="var(--error)" label="errors" value={hovered.errors} />
                        <TooltipRow color="var(--accent)" label="net" value={hovered.wpm} />
                        <TooltipRow color="var(--text-subtle)" label="raw" value={hovered.raw} />
                        <TooltipRow color="var(--text-subtle)" label="burst" value={hovered.burst} swatchOpacity={0.5} />
                    </Stack>
                </Box>
            )}
        </Box>
    );
}

function TooltipRow({
    color,
    label,
    value,
    swatchOpacity,
}: {
    color: string;
    label: string;
    value: number;
    swatchOpacity?: number;
}) {
    return (
        <Flex align="center" justify="space-between" gap={3}>
            <Flex align="center" gap={2}>
                <Box w={2} h={2} bg={color} borderRadius="full" opacity={swatchOpacity} />
                <Text opacity={0.8}>{label}:</Text>
            </Flex>
            <Text fontWeight="bold">{value}</Text>
        </Flex>
    );
}
