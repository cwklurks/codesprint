// lib/analytics/weak-pattern-trends.ts
import type { SessionRecord } from "@/lib/storage/session-history";
import type { TokenCategory } from "@/lib/tokenizer";
import type { SupportedLanguage } from "@/lib/snippets";
import type { TimeRange } from "@/lib/analytics/aggregations";

export type CategoryRate = {
    category: TokenCategory;
    errors: number;
    totalChars: number;
    errorRate: number;
};

export type CategoryTrend = {
    category: TokenCategory;
    currentRate: number;
    previousRate: number;
    deltaPercentagePoints: number;
    status: "improving" | "regressing" | "stable";
    samples: number;
};

export type CategoryTimeSeries = {
    category: TokenCategory;
    points: { date: string; errorRate: number; samples: number }[];
};

export type WeakPatternTrendsSummary = {
    sessionsWithErrorData: number;
    totalSessions: number;
    trends: CategoryTrend[];
    timeSeries: CategoryTimeSeries[];
    topImproving: CategoryTrend[];
    topRegressing: CategoryTrend[];
};

export function aggregateWeakPatternTrends(
    range: TimeRange = "month",
    language?: SupportedLanguage,
): WeakPatternTrendsSummary {
    throw new Error("not implemented");
}
