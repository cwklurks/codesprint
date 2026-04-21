"use client";

import { Box, Flex, Grid, Stack, Text } from "@chakra-ui/react";
import { useMemo, useState } from "react";
import {
    getWpmTrends,
    getLanguageStats,
    getPersonalAverages,
    getProgressOverTime,
    type TimeRange,
    type WpmTrend,
    type LanguageStat,
    type PersonalAverages,
} from "@/lib/analytics/aggregations";
import type { SupportedLanguage } from "@/lib/snippets";
import WeakPatternDashboard from "@/components/analytics/WeakPatternDashboard";

type AnalyticsDashboardProps = {
    onClose?: () => void;
};

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
    { value: "day", label: "Last 24 Hours" },
    { value: "week", label: "Last Week" },
    { value: "month", label: "Last Month" },
    { value: "all", label: "All Time" },
];

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
    javascript: "JavaScript",
    python: "Python",
    java: "Java",
    cpp: "C++",
};

function formatDuration(ms: number): string {
    if (ms <= 0) return "0s";
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds.toFixed(0)}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function formatTrend(value: number): { text: string; color: string } {
    if (value > 5) return { text: `+${value.toFixed(1)}%`, color: "var(--success)" };
    if (value < -5) return { text: `${value.toFixed(1)}%`, color: "var(--error)" };
    return { text: "Stable", color: "var(--text-subtle)" };
}

function TrendIndicator({ trend }: { trend: "improving" | "declining" | "stable" }) {
    const config = {
        improving: { symbol: "↑", color: "var(--success)", label: "Improving" },
        declining: { symbol: "↓", color: "var(--error)", label: "Declining" },
        stable: { symbol: "→", color: "var(--text-subtle)", label: "Stable" },
    };
    const { symbol, color, label } = config[trend];

    return (
        <Flex align="center" gap={1}>
            <Text color={color} fontWeight="bold" fontSize="sm">
                {symbol}
            </Text>
            <Text color={color} fontSize="xs">
                {label}
            </Text>
        </Flex>
    );
}

function StatCard({
    label,
    value,
    subValue,
    highlight = false,
}: {
    label: string;
    value: string | number;
    subValue?: string;
    highlight?: boolean;
}) {
    return (
        <Box
            bg="var(--surface)"
            border="1px solid var(--border)"
            borderRadius="lg"
            p={4}
            textAlign="center"
        >
            <Text
                fontSize="xs"
                textTransform="uppercase"
                letterSpacing="0.1em"
                color="var(--text-subtle)"
                mb={1}
            >
                {label}
            </Text>
            <Text
                fontSize="2xl"
                fontWeight={700}
                color={highlight ? "var(--accent)" : "var(--text)"}
                lineHeight={1.2}
            >
                {value}
            </Text>
            {subValue && (
                <Text fontSize="xs" color="var(--text-subtle)" mt={1}>
                    {subValue}
                </Text>
            )}
        </Box>
    );
}

function WpmTrendChart({ data }: { data: WpmTrend }) {
    if (data.dataPoints.length === 0) {
        return (
            <Flex
                justify="center"
                align="center"
                h="200px"
                bg="var(--surface)"
                borderRadius="lg"
                border="1px solid var(--border)"
            >
                <Text color="var(--text-subtle)">No data available</Text>
            </Flex>
        );
    }

    const maxWpm = Math.max(...data.dataPoints.map((d) => d.wpm), 60);
    const padding = { top: 20, right: 20, bottom: 30, left: 40 };
    const graphWidth = 600;
    const graphHeight = 200;
    const innerWidth = graphWidth - padding.left - padding.right;
    const innerHeight = graphHeight - padding.top - padding.bottom;

    const getX = (index: number) =>
        padding.left + (index / Math.max(data.dataPoints.length - 1, 1)) * innerWidth;
    const getY = (val: number) => padding.top + innerHeight - (val / maxWpm) * innerHeight;

    const wpmPath = data.dataPoints
        .map((d, i) => `${i === 0 ? "M" : "L"} ${getX(i)},${getY(d.wpm)}`)
        .join(" ");

    const areaPath = `${wpmPath} L ${getX(data.dataPoints.length - 1)},${graphHeight - padding.bottom} L ${padding.left},${graphHeight - padding.bottom} Z`;

    return (
        <Box w="100%" h="200px" position="relative">
            <svg
                viewBox={`0 0 ${graphWidth} ${graphHeight}`}
                style={{ width: "100%", height: "100%", overflow: "visible" }}
            >
                {/* Grid Lines */}
                {[0, 0.5, 1].map((t) => {
                    const y = padding.top + innerHeight * (1 - t);
                    return (
                        <g key={t}>
                            <line
                                x1={padding.left}
                                y1={y}
                                x2={graphWidth - padding.right}
                                y2={y}
                                stroke="var(--border)"
                                strokeDasharray="4 4"
                            />
                            <text
                                x={padding.left - 10}
                                y={y + 4}
                                textAnchor="end"
                                fontSize="10"
                                fill="var(--text-subtle)"
                            >
                                {Math.round(maxWpm * t)}
                            </text>
                        </g>
                    );
                })}

                {/* Area Fill */}
                <path d={areaPath} fill="var(--accent)" opacity="0.1" />

                {/* WPM Line */}
                <path d={wpmPath} fill="none" stroke="var(--accent)" strokeWidth="2" />

                {/* Data Points */}
                {data.dataPoints.map((d, i) => (
                    <circle key={i} cx={getX(i)} cy={getY(d.wpm)} r="4" fill="var(--accent)" />
                ))}

                {/* X-axis Labels */}
                {data.dataPoints.length <= 7 &&
                    data.dataPoints.map((d, i) => (
                        <text
                            key={i}
                            x={getX(i)}
                            y={graphHeight - 8}
                            textAnchor="middle"
                            fontSize="9"
                            fill="var(--text-subtle)"
                        >
                            {d.date.slice(5)}
                        </text>
                    ))}
            </svg>
        </Box>
    );
}

function LanguageStatsGrid({ stats }: { stats: LanguageStat[] }) {
    if (stats.length === 0) {
        return (
            <Flex
                justify="center"
                align="center"
                h="100px"
                bg="var(--surface)"
                borderRadius="lg"
                border="1px solid var(--border)"
            >
                <Text color="var(--text-subtle)">No language data available</Text>
            </Flex>
        );
    }

    return (
        <Stack gap={3}>
            {stats.map((stat) => (
                <Flex
                    key={stat.language}
                    align="center"
                    justify="space-between"
                    bg="var(--surface)"
                    border="1px solid var(--border)"
                    borderRadius="lg"
                    p={3}
                >
                    <Flex align="center" gap={3}>
                        <Box
                            w={10}
                            h={10}
                            borderRadius="md"
                            bg="var(--panel-soft)"
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                        >
                            <Text fontWeight="bold" fontSize="xs">
                                {stat.language === "cpp"
                                    ? "C++"
                                    : stat.language.slice(0, 2).toUpperCase()}
                            </Text>
                        </Box>
                        <Box>
                            <Text fontWeight="bold" fontSize="sm">
                                {LANGUAGE_LABELS[stat.language]}
                            </Text>
                            <Text fontSize="xs" color="var(--text-subtle)">
                                {stat.sessionCount} sessions • {formatDuration(stat.totalTimeMs)}
                            </Text>
                        </Box>
                    </Flex>
                    <Flex align="center" gap={4}>
                        <Box textAlign="right">
                            <Text fontSize="lg" fontWeight="bold">
                                {Math.round(stat.averageWpm)}
                            </Text>
                            <Text fontSize="xs" color="var(--text-subtle)">
                                avg WPM
                            </Text>
                        </Box>
                        <Box textAlign="right">
                            <Text fontSize="lg" fontWeight="bold" color="var(--accent)">
                                {Math.round(stat.bestWpm)}
                            </Text>
                            <Text fontSize="xs" color="var(--text-subtle)">
                                best
                            </Text>
                        </Box>
                        <TrendIndicator trend={stat.recentTrend} />
                    </Flex>
                </Flex>
            ))}
        </Stack>
    );
}

function DifficultyBreakdown({ averages }: { averages: PersonalAverages }) {
    const difficulties = ["easy", "medium", "hard"] as const;
    const colors = {
        easy: "var(--success)",
        medium: "var(--warning)",
        hard: "var(--error)",
    };

    return (
        <Flex gap={3} flexWrap="wrap">
            {difficulties.map((difficulty) => {
                const data = averages.byDifficulty[difficulty];
                if (data.sessions === 0) return null;

                return (
                    <Box
                        key={difficulty}
                        flex="1"
                        minW="120px"
                        bg="var(--surface)"
                        border="1px solid var(--border)"
                        borderRadius="lg"
                        p={3}
                        textAlign="center"
                    >
                        <Text
                            fontSize="xs"
                            textTransform="uppercase"
                            letterSpacing="0.05em"
                            color={colors[difficulty]}
                            fontWeight="bold"
                            mb={1}
                        >
                            {difficulty}
                        </Text>
                        <Text fontSize="xl" fontWeight="bold">
                            {Math.round(data.wpm)}
                        </Text>
                        <Text fontSize="xs" color="var(--text-subtle)">
                            WPM • {data.sessions} sessions
                        </Text>
                    </Box>
                );
            })}
        </Flex>
    );
}

function ProgressChart({
    data,
}: {
    data: { date: string; cumulativeAvgWpm: number; cumulativeSessions: number }[];
}) {
    if (data.length === 0) {
        return (
            <Flex
                justify="center"
                align="center"
                h="150px"
                bg="var(--surface)"
                borderRadius="lg"
                border="1px solid var(--border)"
            >
                <Text color="var(--text-subtle)">No progress data available</Text>
            </Flex>
        );
    }

    const maxWpm = Math.max(...data.map((d) => d.cumulativeAvgWpm), 60);
    const padding = { top: 15, right: 15, bottom: 25, left: 35 };
    const graphWidth = 500;
    const graphHeight = 150;
    const innerWidth = graphWidth - padding.left - padding.right;
    const innerHeight = graphHeight - padding.top - padding.bottom;

    const getX = (index: number) =>
        padding.left + (index / Math.max(data.length - 1, 1)) * innerWidth;
    const getY = (val: number) => padding.top + innerHeight - (val / maxWpm) * innerHeight;

    const path = data
        .map((d, i) => `${i === 0 ? "M" : "L"} ${getX(i)},${getY(d.cumulativeAvgWpm)}`)
        .join(" ");

    return (
        <Box w="100%" h="150px">
            <svg
                viewBox={`0 0 ${graphWidth} ${graphHeight}`}
                style={{ width: "100%", height: "100%", overflow: "visible" }}
            >
                {/* Grid */}
                <line
                    x1={padding.left}
                    y1={graphHeight - padding.bottom}
                    x2={graphWidth - padding.right}
                    y2={graphHeight - padding.bottom}
                    stroke="var(--border)"
                />

                {/* Progress Line */}
                <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" />

                {/* End Point */}
                {data.length > 0 && (
                    <circle
                        cx={getX(data.length - 1)}
                        cy={getY(data[data.length - 1].cumulativeAvgWpm)}
                        r="5"
                        fill="var(--accent)"
                    />
                )}

                {/* Labels */}
                <text
                    x={padding.left - 5}
                    y={padding.top}
                    textAnchor="end"
                    fontSize="9"
                    fill="var(--text-subtle)"
                >
                    {Math.round(maxWpm)}
                </text>
                <text
                    x={padding.left - 5}
                    y={graphHeight - padding.bottom}
                    textAnchor="end"
                    fontSize="9"
                    fill="var(--text-subtle)"
                >
                    0
                </text>
            </svg>
        </Box>
    );
}

export default function AnalyticsDashboard(_props: AnalyticsDashboardProps) {
    const [timeRange, setTimeRange] = useState<TimeRange>("week");

    const wpmTrends = useMemo(() => getWpmTrends(timeRange), [timeRange]);
    const languageStats = useMemo(() => getLanguageStats(timeRange), [timeRange]);
    const personalAverages = useMemo(() => getPersonalAverages(timeRange), [timeRange]);
    const progressData = useMemo(() => getProgressOverTime(timeRange), [timeRange]);

    const trendInfo = formatTrend(wpmTrends.overallChange);

    const hasData = personalAverages.totalSessions > 0;

    return (
        <Box
            borderRadius="20px"
            border="1px solid var(--border)"
            bg="var(--panel-soft)"
            boxShadow="var(--shadow)"
            p={{ base: 4, md: 6 }}
            w="100%"
            maxW="900px"
        >
            <Stack gap={6}>
                {/* Header */}
                <Flex justify="space-between" align="center">
                    <Box>
                        <Text fontSize="2xl" fontWeight="bold">
                            Analytics
                        </Text>
                        <Text fontSize="sm" color="var(--text-subtle)">
                            Track your typing performance over time
                        </Text>
                    </Box>
                    <select
                        value={timeRange}
                        onChange={(e) => setTimeRange(e.target.value as TimeRange)}
                        style={{
                            padding: "6px 12px",
                            fontSize: "14px",
                            borderRadius: "6px",
                            border: "1px solid var(--border)",
                            background: "var(--surface)",
                            color: "var(--text)",
                            cursor: "pointer",
                            fontFamily: "inherit",
                        }}
                    >
                        {TIME_RANGE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value} style={{ background: "var(--bg)", color: "var(--text)" }}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </Flex>

                {!hasData ? (
                    <Flex
                        direction="column"
                        align="center"
                        justify="center"
                        py={12}
                        gap={3}
                        bg="var(--surface)"
                        borderRadius="lg"
                        border="1px solid var(--border)"
                    >
                        <Text fontSize="lg" fontWeight="bold">
                            No Session Data Yet
                        </Text>
                        <Text color="var(--text-subtle)" textAlign="center" maxW="300px">
                            Complete some typing sessions to see your analytics and track your
                            progress over time.
                        </Text>
                    </Flex>
                ) : (
                    <>
                        {/* Overview Stats */}
                        <Grid
                            templateColumns={{
                                base: "repeat(2, 1fr)",
                                md: "repeat(4, 1fr)",
                            }}
                            gap={3}
                        >
                            <StatCard
                                label="Average WPM"
                                value={Math.round(personalAverages.overallWpm)}
                                highlight
                            />
                            <StatCard
                                label="Best WPM"
                                value={Math.round(personalAverages.bestWpm)}
                            />
                            <StatCard
                                label="Accuracy"
                                value={`${(personalAverages.overallAccuracy * 100).toFixed(1)}%`}
                            />
                            <StatCard
                                label="Sessions"
                                value={personalAverages.totalSessions}
                                subValue={formatDuration(personalAverages.totalTimeMs)}
                            />
                        </Grid>

                        {/* WPM Trend Section */}
                        <Box>
                            <Flex justify="space-between" align="center" mb={3}>
                                <Text fontWeight="bold">WPM Trend</Text>
                                <Text color={trendInfo.color} fontSize="sm" fontWeight="bold">
                                    {trendInfo.text}
                                </Text>
                            </Flex>
                            <Box
                                bg="var(--surface)"
                                border="1px solid var(--border)"
                                borderRadius="lg"
                                p={4}
                            >
                                <WpmTrendChart data={wpmTrends} />
                                {wpmTrends.peakDate && (
                                    <Text fontSize="xs" color="var(--text-subtle)" mt={2}>
                                        Peak: {Math.round(wpmTrends.peakWpm)} WPM on{" "}
                                        {wpmTrends.peakDate}
                                    </Text>
                                )}
                            </Box>
                        </Box>

                        {/* Language Performance */}
                        <Box>
                            <Text fontWeight="bold" mb={3}>
                                Performance by Language
                            </Text>
                            <LanguageStatsGrid stats={languageStats} />
                        </Box>

                        {/* Difficulty Breakdown */}
                        <Box>
                            <Text fontWeight="bold" mb={3}>
                                Performance by Difficulty
                            </Text>
                            <DifficultyBreakdown averages={personalAverages} />
                        </Box>

                        {/* Cumulative Progress */}
                        <Box>
                            <Text fontWeight="bold" mb={3}>
                                Cumulative Progress
                            </Text>
                            <Box
                                bg="var(--surface)"
                                border="1px solid var(--border)"
                                borderRadius="lg"
                                p={4}
                            >
                                <ProgressChart data={progressData} />
                                {progressData.length > 0 && (
                                    <Text fontSize="xs" color="var(--text-subtle)" mt={2}>
                                        {progressData[progressData.length - 1].cumulativeSessions}{" "}
                                        total sessions tracked
                                    </Text>
                                )}
                            </Box>
                        </Box>

                        {/* Weak Pattern Trends */}
                        <Box>
                            <Text fontWeight="bold" mb={3}>
                                Syntax Category Trends
                            </Text>
                            <WeakPatternDashboard timeRange={timeRange} />
                        </Box>
                    </>
                )}
            </Stack>
        </Box>
    );
}
