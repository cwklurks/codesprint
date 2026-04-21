import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionRecord } from "@/lib/storage/session-history";

const mockSessions: SessionRecord[] = [];
vi.mock("@/lib/storage/session-history", () => ({
    getSessions: vi.fn(() => [...mockSessions]),
}));

import { aggregateCategoryErrorRates, computeCategoryTrend, buildCategoryTimeSeries, selectTopMovers } from "../weak-pattern-trends";

function makeSession(overrides: Partial<SessionRecord> = {}): SessionRecord {
    return {
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        snippetId: "snip-1",
        language: "javascript",
        lengthCategory: "short",
        difficulty: "easy",
        wpm: 60,
        rawWpm: 65,
        accuracy: 0.95,
        elapsedMs: 10000,
        totalKeystrokes: 100,
        correctKeystrokes: 95,
        errorCount: 5,
        history: [],
        ...overrides,
    };
}

describe("aggregateCategoryErrorRates", () => {
    beforeEach(() => {
        mockSessions.length = 0;
    });

    it("returns all zero categories when called with no sessions", () => {
        const rates = aggregateCategoryErrorRates([]);
        expect(rates.keyword.errors).toBe(0);
        expect(rates.keyword.totalChars).toBe(0);
        expect(rates.keyword.errorRate).toBe(0);
    });

    it("counts errors by tokenized category for a JS snippet", () => {
        const snippetContent = "const x = 1;";
        // tokenization: "const" keyword 0-5, " " ws 5-6, "x" ident 6-7, " " ws 7-8,
        // "=" op 8-9, " " ws 9-10, "1" literal 10-11, ";" delim 11-12
        const session = makeSession({
            language: "javascript",
            snippetContent,
            errors: [
                { expected: "c", got: "x", index: 0 },   // keyword
                { expected: "o", got: "x", index: 1 },   // keyword
                { expected: "=", got: "x", index: 8 },   // operator
            ],
        });
        const rates = aggregateCategoryErrorRates([session]);
        expect(rates.keyword.errors).toBe(2);
        expect(rates.operator.errors).toBe(1);
        expect(rates.delimiter.errors).toBe(0);
        expect(rates.keyword.totalChars).toBe(5);   // "const"
        expect(rates.operator.totalChars).toBe(1);  // "="
        expect(rates.keyword.errorRate).toBeCloseTo(2 / 5, 3);
        expect(rates.operator.errorRate).toBeCloseTo(1 / 1, 3);
    });

    it("accumulates across multiple sessions", () => {
        const content = "if (x) {}";
        const s1 = makeSession({
            language: "javascript",
            snippetContent: content,
            errors: [{ expected: "i", got: "x", index: 0 }], // keyword
        });
        const s2 = makeSession({
            language: "javascript",
            snippetContent: content,
            errors: [{ expected: "f", got: "x", index: 1 }], // keyword
        });
        const rates = aggregateCategoryErrorRates([s1, s2]);
        expect(rates.keyword.errors).toBe(2);
        expect(rates.keyword.totalChars).toBe(4);  // "if" * 2 sessions
    });

    it("counts totalChars for perfect sessions (errors=[]) so improvement is detectable", () => {
        const content = "const x = 1;";
        const perfectSession = makeSession({
            language: "javascript",
            snippetContent: content,
            errors: [], // perfect session
        });
        const errorSession = makeSession({
            language: "javascript",
            snippetContent: content,
            errors: [{ expected: "c", got: "x", index: 0 }],
        });
        const rates = aggregateCategoryErrorRates([perfectSession, errorSession]);
        // Both sessions tokenized: keyword chars appear twice (5 * 2 = 10)
        expect(rates.keyword.totalChars).toBe(10);
        expect(rates.keyword.errors).toBe(1);
        expect(rates.keyword.errorRate).toBeCloseTo(1 / 10, 3);
    });

    it("skips sessions missing errors or snippetContent", () => {
        const s1 = makeSession({ errors: undefined, snippetContent: "const x;" });
        const s2 = makeSession({
            errors: [{ expected: "a", got: "b", index: 0 }],
            snippetContent: undefined,
        });
        const rates = aggregateCategoryErrorRates([s1, s2]);
        expect(rates.keyword.errors).toBe(0);
        expect(rates.keyword.totalChars).toBe(0);
    });
});

describe("computeCategoryTrend", () => {
    it("flags improving category when current error rate drops more than 2pp", () => {
        const current = { category: "operator" as const, errors: 5, totalChars: 100, errorRate: 0.05 };
        const previous = { category: "operator" as const, errors: 12, totalChars: 100, errorRate: 0.12 };
        const trend = computeCategoryTrend(current, previous, 50);
        expect(trend.status).toBe("improving");
        expect(trend.deltaPercentagePoints).toBeCloseTo(-7, 2);
    });

    it("flags declining category when current error rate climbs more than 2pp", () => {
        const current = { category: "keyword" as const, errors: 10, totalChars: 100, errorRate: 0.10 };
        const previous = { category: "keyword" as const, errors: 5, totalChars: 100, errorRate: 0.05 };
        const trend = computeCategoryTrend(current, previous, 50);
        expect(trend.status).toBe("declining");
        expect(trend.deltaPercentagePoints).toBeCloseTo(5, 2);
    });

    it("flags stable when delta is within 2pp threshold", () => {
        const current = { category: "identifier" as const, errors: 10, totalChars: 100, errorRate: 0.10 };
        const previous = { category: "identifier" as const, errors: 11, totalChars: 100, errorRate: 0.11 };
        const trend = computeCategoryTrend(current, previous, 50);
        expect(trend.status).toBe("stable");
    });

    it("forces stable when samples under threshold (10 sessions)", () => {
        const current = { category: "operator" as const, errors: 0, totalChars: 100, errorRate: 0 };
        const previous = { category: "operator" as const, errors: 20, totalChars: 100, errorRate: 0.20 };
        const trend = computeCategoryTrend(current, previous, 5);
        expect(trend.status).toBe("stable");
        expect(trend.samples).toBe(5);
    });

    it("is stable at exactly -2pp (boundary is exclusive)", () => {
        const current = { category: "operator" as const, errors: 2, totalChars: 100, errorRate: 0.02 };
        const previous = { category: "operator" as const, errors: 4, totalChars: 100, errorRate: 0.04 };
        const trend = computeCategoryTrend(current, previous, 50);
        expect(trend.status).toBe("stable");
    });

    it("is stable at exactly +2pp (boundary is exclusive)", () => {
        const current = { category: "operator" as const, errors: 4, totalChars: 100, errorRate: 0.04 };
        const previous = { category: "operator" as const, errors: 2, totalChars: 100, errorRate: 0.02 };
        const trend = computeCategoryTrend(current, previous, 50);
        expect(trend.status).toBe("stable");
    });
});

describe("buildCategoryTimeSeries", () => {
    it("returns one series per category with one point per calendar day", () => {
        const sessions = [
            makeSession({
                date: "2026-04-01T10:00:00Z",
                language: "javascript",
                snippetContent: "const x = 1;",
                errors: [{ expected: "c", got: "x", index: 0 }], // keyword
            }),
            makeSession({
                date: "2026-04-01T11:00:00Z",
                language: "javascript",
                snippetContent: "const x = 1;",
                errors: [{ expected: "=", got: "x", index: 8 }], // operator
            }),
            makeSession({
                date: "2026-04-02T10:00:00Z",
                language: "javascript",
                snippetContent: "const x = 1;",
                errors: [], // perfect session
            }),
        ];
        const series = buildCategoryTimeSeries(sessions);
        const keywordSeries = series.find((s) => s.category === "keyword");
        expect(keywordSeries).toBeDefined();
        expect(keywordSeries!.points).toHaveLength(2);
        expect(keywordSeries!.points[0].date).toBe("2026-04-01");
        // Day 1: 2 sessions, each "const" = 5 keyword chars → 10 total, 1 error on keyword
        expect(keywordSeries!.points[0].errorRate).toBeCloseTo(1 / 10, 3);
        expect(keywordSeries!.points[1].date).toBe("2026-04-02");
        expect(keywordSeries!.points[1].errorRate).toBe(0);
    });

    it("returns 8 empty series when no sessions", () => {
        const series = buildCategoryTimeSeries([]);
        expect(series).toHaveLength(8);
        for (const s of series) expect(s.points).toEqual([]);
    });
});

describe("selectTopMovers", () => {
    function makeTrend(
        category: import("@/lib/tokenizer").TokenCategory,
        deltaPp: number,
        status: "improving" | "declining" | "stable",
    ): import("../weak-pattern-trends").CategoryTrend {
        return {
            category,
            currentRate: 0.05,
            previousRate: 0.05 + deltaPp / 100,
            deltaPercentagePoints: deltaPp,
            status,
            samples: 20,
        };
    }

    it("returns top 3 improving sorted by largest drop first", () => {
        const trends = [
            makeTrend("keyword", -8, "improving"),
            makeTrend("operator", -3, "improving"),
            makeTrend("delimiter", -10, "improving"),
            makeTrend("identifier", -5, "improving"),
            makeTrend("string", -1, "stable"),
        ];
        const { topImproving, topDeclining } = selectTopMovers(trends);
        expect(topImproving.map((t) => t.category)).toEqual(["delimiter", "keyword", "identifier"]);
        expect(topDeclining).toEqual([]);
    });

    it("returns top 3 declining sorted by largest climb first", () => {
        const trends = [
            makeTrend("keyword", 8, "declining"),
            makeTrend("operator", 3, "declining"),
            makeTrend("delimiter", 12, "declining"),
            makeTrend("identifier", 5, "declining"),
        ];
        const { topDeclining } = selectTopMovers(trends);
        expect(topDeclining.map((t) => t.category)).toEqual(["delimiter", "keyword", "identifier"]);
    });

    it("ignores stable trends in both lists", () => {
        const trends = [
            makeTrend("keyword", 0.5, "stable"),
            makeTrend("operator", -0.3, "stable"),
        ];
        const { topImproving, topDeclining } = selectTopMovers(trends);
        expect(topImproving).toEqual([]);
        expect(topDeclining).toEqual([]);
    });
});
