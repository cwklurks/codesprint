// lib/analytics/weak-pattern-trends.ts
import type { SessionRecord } from "@/lib/storage/session-history";
import type { TokenCategory } from "@/lib/tokenizer";
import type { SupportedLanguage } from "@/lib/snippets";
import type { TimeRange } from "@/lib/analytics/aggregations";
import { tokenize, buildCategoryMap } from "@/lib/tokenizer";

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
    status: "improving" | "declining" | "stable";
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
    topDeclining: CategoryTrend[];
};

export function aggregateWeakPatternTrends(
    range: TimeRange = "month",
    language?: SupportedLanguage,
): WeakPatternTrendsSummary {
    throw new Error("not implemented");
}

const ALL_CATEGORIES: TokenCategory[] = [
    "keyword", "operator", "delimiter", "identifier",
    "literal", "whitespace", "comment", "string",
];

function emptyRates(): Record<TokenCategory, CategoryRate> {
    const out = {} as Record<TokenCategory, CategoryRate>;
    for (const c of ALL_CATEGORIES) {
        out[c] = { category: c, errors: 0, totalChars: 0, errorRate: 0 };
    }
    return out;
}

export function aggregateCategoryErrorRates(
    sessions: readonly SessionRecord[],
): Record<TokenCategory, CategoryRate> {
    const rates = emptyRates();
    const cache = new Map<string, { map: TokenCategory[]; length: number }>();

    for (const session of sessions) {
        const content = session.snippetContent;
        if (!content) continue;
        // `errors` may be undefined (old records) or [] (perfect session).
        // We skip old records entirely (no error-tracking data), but perfect
        // sessions count toward totalChars so improvement is detectable.
        const errors = session.errors;
        if (errors === undefined) continue;

        const key = `${session.language}::${session.snippetId}`;
        let entry = cache.get(key);
        if (!entry) {
            const tokens = tokenize(content, session.language);
            const map = buildCategoryMap(tokens, content.length);
            entry = { map, length: content.length };
            cache.set(key, entry);
        }

        for (let i = 0; i < entry.length; i++) {
            rates[entry.map[i]].totalChars += 1;
        }

        for (const err of errors) {
            if (err.index < 0 || err.index >= entry.length) continue;
            rates[entry.map[err.index]].errors += 1;
        }
    }

    for (const c of ALL_CATEGORIES) {
        const r = rates[c];
        r.errorRate = r.totalChars > 0 ? r.errors / r.totalChars : 0;
    }

    return rates;
}

const MIN_SAMPLES_FOR_TREND = 10;
const STABLE_THRESHOLD_PP = 2;

export function computeCategoryTrend(
    current: CategoryRate,
    previous: CategoryRate,
    samples: number,
): CategoryTrend {
    const deltaPp = (current.errorRate - previous.errorRate) * 100;

    let status: CategoryTrend["status"];
    if (samples < MIN_SAMPLES_FOR_TREND) {
        status = "stable";
    } else if (deltaPp < -STABLE_THRESHOLD_PP) {
        status = "improving";
    } else if (deltaPp > STABLE_THRESHOLD_PP) {
        status = "declining";
    } else {
        status = "stable";
    }

    return {
        category: current.category,
        currentRate: current.errorRate,
        previousRate: previous.errorRate,
        deltaPercentagePoints: deltaPp,
        status,
        samples,
    };
}
