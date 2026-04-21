// lib/analytics/weak-pattern-trends.ts
import type { SessionRecord } from "@/lib/storage/session-history";
import type { TokenCategory } from "@/lib/tokenizer";
import type { SupportedLanguage } from "@/lib/snippets";
import type { TimeRange } from "@/lib/analytics/aggregations";
import { tokenize, buildCategoryMap } from "@/lib/tokenizer";
import { getSessions } from "@/lib/storage/session-history";

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

export const ALL_CATEGORIES: TokenCategory[] = [
    "keyword", "operator", "delimiter", "identifier",
    "literal", "whitespace", "comment", "string",
];

export function aggregateWeakPatternTrends(
    range: TimeRange = "month",
    language?: SupportedLanguage,
): WeakPatternTrendsSummary {
    const all = getSessions(language ? { language } : undefined);

    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;
    // "all" uses Infinity so the current window is truly all-time. The previous
    // window collapses to empty in that case — the min-samples guard below
    // forces every trend to "stable", so the dashboard shows real all-time error
    // rates without claiming any trend direction.
    const windowDays = range === "day" ? 1 : range === "week" ? 7 : range === "month" ? 30 : Infinity;

    const currentStart = now - windowDays * DAY_MS;
    const previousStart = now - 2 * windowDays * DAY_MS;

    const current = all.filter((s) => new Date(s.date).getTime() >= currentStart);
    const previous = all.filter((s) => {
        const t = new Date(s.date).getTime();
        return t >= previousStart && t < currentStart;
    });

    const countWithErrorData = (list: SessionRecord[]) =>
        list.filter((s) => s.errors !== undefined && s.snippetContent !== undefined).length;
    const sessionsWithErrorData = countWithErrorData(current);
    const previousSessionsWithErrorData = countWithErrorData(previous);

    const currentRates = aggregateCategoryErrorRates(current);
    const previousRates = aggregateCategoryErrorRates(previous);

    // Trend classification requires BOTH windows to have data. When previous
    // window is empty (new user, or "all" range with < 2×windowDays of history),
    // every category would otherwise compare against previousRate=0 and read
    // as "declining". Use the smaller of the two as the sample count so the
    // MIN_SAMPLES gate forces "stable" in that case.
    const comparableSamples = Math.min(sessionsWithErrorData, previousSessionsWithErrorData);

    const trends: CategoryTrend[] = ALL_CATEGORIES.map((c) =>
        computeCategoryTrend(currentRates[c], previousRates[c], comparableSamples),
    );

    const timeSeries = buildCategoryTimeSeries(current);
    const { topImproving, topDeclining } = selectTopMovers(trends);

    return {
        sessionsWithErrorData,
        totalSessions: current.length,
        trends,
        timeSeries,
        topImproving,
        topDeclining,
    };
}

function emptyRates(): Record<TokenCategory, CategoryRate> {
    const out = {} as Record<TokenCategory, CategoryRate>;
    for (const c of ALL_CATEGORIES) {
        out[c] = { category: c, errors: 0, totalChars: 0, errorRate: 0 };
    }
    return out;
}

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
    const cache = new Map<string, { map: TokenCategory[]; length: number }>();

    for (const session of sessions) {
        const content = session.snippetContent;
        if (!content) continue;
        // `errors` may be undefined (old records) or [] (perfect session).
        // We skip old records entirely (no error-tracking data), but perfect
        // sessions count toward totalChars so improvement is detectable.
        const errors = session.errors;
        if (errors === undefined) continue;

        // Key by content hash, not snippetId — a snippet's content can change
        // across sync:leetcode runs (or AI drill variations) while the id stays
        // the same. Caching by id would serve a stale category map and
        // misclassify errors. Hash collision risk is ~0 at realistic scale.
        const key = `${session.language}::${hashContent(content)}`;
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

function formatDateKey(date: Date): string {
    return date.toISOString().split("T")[0];
}

export function buildCategoryTimeSeries(
    sessions: readonly SessionRecord[],
): CategoryTimeSeries[] {
    // Legacy sessions (errors or snippetContent missing) can't contribute to
    // category analysis. Days containing ONLY legacy sessions would otherwise
    // emit a fake "0% error rate" point, which reads as a perfect day instead
    // of a no-data day. Filter them out before grouping.
    const analyzable = sessions.filter(
        (s) => s.errors !== undefined && s.snippetContent !== undefined,
    );

    const byDate = new Map<string, SessionRecord[]>();
    for (const s of analyzable) {
        const key = formatDateKey(new Date(s.date));
        const arr = byDate.get(key);
        if (arr) arr.push(s);
        else byDate.set(key, [s]);
    }

    const sortedDates = Array.from(byDate.keys()).sort();

    const seriesByCategory: Record<TokenCategory, CategoryTimeSeries> = {} as Record<TokenCategory, CategoryTimeSeries>;
    for (const c of ALL_CATEGORIES) {
        seriesByCategory[c] = { category: c, points: [] };
    }

    for (const date of sortedDates) {
        const daySessions = byDate.get(date) ?? [];
        const rates = aggregateCategoryErrorRates(daySessions);
        for (const c of ALL_CATEGORIES) {
            seriesByCategory[c].points.push({
                date,
                errorRate: rates[c].errorRate,
                samples: daySessions.length,
            });
        }
    }

    return ALL_CATEGORIES.map((c) => seriesByCategory[c]);
}

const TOP_MOVERS = 3;

export function selectTopMovers(trends: readonly CategoryTrend[]): {
    topImproving: CategoryTrend[];
    topDeclining: CategoryTrend[];
} {
    const improving = trends
        .filter((t) => t.status === "improving")
        .sort((a, b) => a.deltaPercentagePoints - b.deltaPercentagePoints)
        .slice(0, TOP_MOVERS);

    const declining = trends
        .filter((t) => t.status === "declining")
        .sort((a, b) => b.deltaPercentagePoints - a.deltaPercentagePoints)
        .slice(0, TOP_MOVERS);

    return { topImproving: improving, topDeclining: declining };
}
