// components/analytics/WeakPatternDashboard.tsx
"use client";

import { Box, Flex, Grid, Stack, Text } from "@chakra-ui/react";
import { useMemo } from "react";
import type { TimeRange } from "@/lib/analytics/aggregations";
import {
    aggregateWeakPatternTrends,
    type CategoryTrend,
    type CategoryTimeSeries,
} from "@/lib/analytics/weak-pattern-trends";
import type { TokenCategory } from "@/lib/tokenizer";
import type { SupportedLanguage } from "@/lib/snippets";

const CATEGORY_LABELS: Record<TokenCategory, string> = {
    keyword: "Keywords",
    operator: "Operators",
    delimiter: "Delimiters",
    identifier: "Identifiers",
    literal: "Literals",
    string: "Strings",
    comment: "Comments",
    whitespace: "Whitespace",
};

function formatDelta(trend: CategoryTrend): { text: string; color: string } {
    const abs = Math.abs(trend.deltaPercentagePoints).toFixed(1);
    if (trend.status === "improving") return { text: `-${abs}pp`, color: "var(--success)" };
    if (trend.status === "declining") return { text: `+${abs}pp`, color: "var(--error)" };
    return { text: "Stable", color: "var(--text-subtle)" };
}

function Sparkline({ series }: { series: CategoryTimeSeries }) {
    if (series.points.length < 2) {
        return (
            <Flex justify="center" align="center" h="48px">
                <Text fontSize="xs" color="var(--text-subtle)">
                    Not enough data
                </Text>
            </Flex>
        );
    }

    const rates = series.points.map((p) => p.errorRate);
    const max = Math.max(...rates, 0.0001);
    const width = 160;
    const height = 48;
    const getX = (i: number) => (i / Math.max(series.points.length - 1, 1)) * width;
    const getY = (r: number) => height - (r / max) * (height - 4) - 2;

    const path = series.points
        .map((p, i) => `${i === 0 ? "M" : "L"} ${getX(i).toFixed(1)},${getY(p.errorRate).toFixed(1)}`)
        .join(" ");

    return (
        <svg width={width} height={height} style={{ display: "block" }}>
            <path d={path} fill="none" stroke="var(--accent)" strokeWidth="1.5" />
        </svg>
    );
}

function CategoryCard({
    trend,
    series,
}: {
    trend: CategoryTrend;
    series: CategoryTimeSeries;
}) {
    const delta = formatDelta(trend);
    return (
        <Box
            bg="var(--surface)"
            border="1px solid var(--border)"
            borderRadius="lg"
            p={3}
        >
            <Flex justify="space-between" align="baseline" mb={1}>
                <Text fontSize="sm" fontWeight="bold">
                    {CATEGORY_LABELS[trend.category]}
                </Text>
                <Text fontSize="xs" color={delta.color} fontWeight="bold">
                    {delta.text}
                </Text>
            </Flex>
            <Text fontSize="xs" color="var(--text-subtle)" mb={2}>
                {(trend.currentRate * 100).toFixed(1)}% error rate
            </Text>
            <Sparkline series={series} />
        </Box>
    );
}

function MoversList({
    title,
    trends,
    tone,
}: {
    title: string;
    trends: CategoryTrend[];
    tone: "success" | "error";
}) {
    const toneColor = tone === "success" ? "var(--success)" : "var(--error)";
    return (
        <Box
            bg="var(--surface)"
            border="1px solid var(--border)"
            borderRadius="lg"
            p={4}
            flex="1"
            minW="220px"
        >
            <Text fontSize="sm" fontWeight="bold" color={toneColor} mb={2}>
                {title}
            </Text>
            {trends.length === 0 ? (
                <Text fontSize="xs" color="var(--text-subtle)">
                    No movers this period
                </Text>
            ) : (
                <Stack gap={1}>
                    {trends.map((t) => {
                        const delta = formatDelta(t);
                        return (
                            <Flex key={t.category} justify="space-between" align="baseline">
                                <Text fontSize="sm">{CATEGORY_LABELS[t.category]}</Text>
                                <Text fontSize="xs" color={delta.color} fontWeight="bold">
                                    {delta.text}
                                </Text>
                            </Flex>
                        );
                    })}
                </Stack>
            )}
        </Box>
    );
}

type WeakPatternDashboardProps = {
    timeRange: TimeRange;
    language?: SupportedLanguage;
};

export default function WeakPatternDashboard({
    timeRange,
    language,
}: WeakPatternDashboardProps) {
    const summary = useMemo(
        () => aggregateWeakPatternTrends(timeRange, language),
        [timeRange, language],
    );

    if (summary.sessionsWithErrorData === 0) {
        return (
            <Flex
                justify="center"
                align="center"
                h="100px"
                bg="var(--surface)"
                borderRadius="lg"
                border="1px solid var(--border)"
            >
                <Text color="var(--text-subtle)" fontSize="sm" textAlign="center" maxW="320px">
                    Type more sessions to see which syntax categories you are improving on.
                </Text>
            </Flex>
        );
    }

    return (
        <Stack gap={4}>
            <Flex gap={3} flexWrap="wrap">
                <MoversList title="Top improving" trends={summary.topImproving} tone="success" />
                <MoversList title="Top declining" trends={summary.topDeclining} tone="error" />
            </Flex>
            <Grid
                templateColumns={{ base: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }}
                gap={3}
            >
                {summary.trends.map((t) => {
                    const series = summary.timeSeries.find((s) => s.category === t.category)!;
                    return <CategoryCard key={t.category} trend={t} series={series} />;
                })}
            </Grid>
        </Stack>
    );
}
