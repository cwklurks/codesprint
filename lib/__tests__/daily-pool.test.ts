import { describe, expect, it } from "vitest";

import { getDailyPool, getTodaysDaily, DAILY_MIN_NON_EMPTY_LINES } from "../daily-pool";
import { isSkeletal } from "../snippet-filter";
import { CURATED_SNIPPETS_LIST } from "../snippets";

function nonEmptyLineCount(content: string): number {
    return content
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0).length;
}

describe("getDailyPool", () => {
    it("resolves asynchronously (lazy-loaded pool)", () => {
        const result = getDailyPool();
        expect(typeof (result as Promise<unknown>).then).toBe("function");
        return result;
    });

    it("is non-empty", async () => {
        const pool = await getDailyPool();
        expect(pool.length).toBeGreaterThan(0);
    });

    it("exports a min-line floor of 6", () => {
        expect(DAILY_MIN_NON_EMPTY_LINES).toBe(6);
    });

    it("excludes snippets with fewer than the floor of non-empty lines", async () => {
        const pool = await getDailyPool();
        for (const snippet of pool) {
            expect(nonEmptyLineCount(snippet.content)).toBeGreaterThanOrEqual(
                DAILY_MIN_NON_EMPTY_LINES,
            );
        }
    });

    it("excludes skeletal snippets", async () => {
        const pool = await getDailyPool();
        for (const snippet of pool) {
            expect(isSkeletal(snippet.content, snippet.language)).toBe(false);
        }
    });

    it("includes the committed curated snippets that meet the daily floor", async () => {
        const pool = await getDailyPool();
        const poolIds = new Set(pool.map((s) => s.id));
        const eligible = CURATED_SNIPPETS_LIST.filter(
            (s) =>
                nonEmptyLineCount(s.content) >= DAILY_MIN_NON_EMPTY_LINES &&
                !isSkeletal(s.content, s.language),
        );
        expect(eligible.length).toBeGreaterThan(0);
        for (const curated of eligible) {
            expect(poolIds.has(curated.id)).toBe(true);
        }
    });

    it("includes built-in snippets from every supported language", async () => {
        const pool = await getDailyPool();
        const languages = new Set(pool.map((s) => s.language));
        expect(languages.has("javascript")).toBe(true);
        expect(languages.has("python")).toBe(true);
        expect(languages.has("java")).toBe(true);
        expect(languages.has("cpp")).toBe(true);
    });

    it("excludes AI drills (no problemId starts with ai-drill-)", async () => {
        const pool = await getDailyPool();
        expect(pool.some((s) => s.problemId.startsWith("ai-drill-"))).toBe(false);
    });

    it("is sorted by id so it is stable across users", async () => {
        const pool = await getDailyPool();
        const ids = pool.map((s) => s.id);
        const sorted = [...ids].sort((a, b) => a.localeCompare(b));
        expect(ids).toEqual(sorted);
    });

    it("has no duplicate ids", async () => {
        const pool = await getDailyPool();
        const ids = pool.map((s) => s.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it("returns a fresh array each call (no shared mutation surface)", async () => {
        const a = await getDailyPool();
        const b = await getDailyPool();
        expect(a).not.toBe(b);
        expect(a.map((s) => s.id)).toEqual(b.map((s) => s.id));
    });
});

describe("getTodaysDaily", () => {
    it("is deterministic for a given date", async () => {
        const first = await getTodaysDaily("2025-06-15");
        const second = await getTodaysDaily("2025-06-15");
        expect(first).not.toBeNull();
        expect(first!.id).toBe(second!.id);
    });

    it("returns a snippet that exists in the daily pool", async () => {
        const pool = await getDailyPool();
        const picked = await getTodaysDaily("2025-06-15");
        expect(pool.some((s) => s.id === picked!.id)).toBe(true);
    });

    it("spreads across multiple dates", async () => {
        const dates = [
            "2025-06-15",
            "2025-06-16",
            "2025-06-17",
            "2025-06-18",
            "2025-06-19",
        ];
        const ids = await Promise.all(
            dates.map(async (d) => (await getTodaysDaily(d))!.id),
        );
        expect(new Set(ids).size).toBeGreaterThan(1);
    });
});
