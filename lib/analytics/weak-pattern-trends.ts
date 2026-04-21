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
    "literal", "string", "comment", "whitespace",
];

function emptyRates(): Record<TokenCategory, CategoryRate> {
    const out = {} as Record<TokenCategory, CategoryRate>;
    for (const c of ALL_CATEGORIES) {
        out[c] = { category: c, errors: 0, totalChars: 0, errorRate: 0 };
    }
    return out;
}

type CategoryMapCacheKey = string; // `${language}::${snippetContentHash}`
function hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        hash = ((hash << 5) - hash + content.charCodeAt(i)) | 0;
    }
    return `${content.length}:${hash}`;
}

export function aggregateCategoryErrorRates(
    sessions: readonly SessionRecord[],
): Record<TokenCategory, CategoryRate> {
    const rates = emptyRates();
    const cache = new Map<CategoryMapCacheKey, { map: TokenCategory[]; length: number }>();

    for (const session of sessions) {
        const errors = session.errors;
        const content = session.snippetContent;
        if (!errors || !content || errors.length === 0) continue;

        const key: CategoryMapCacheKey = `${session.language}::${hashContent(content)}`;
        let entry = cache.get(key);
        if (!entry) {
            const tokens = tokenize(content, session.language);
            const map = buildCategoryMap(tokens, content.length);
            entry = { map, length: content.length };
            cache.set(key, entry);
        }

        // Total-chars accumulates once per session (weighted by how often each category appears)
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
