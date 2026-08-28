import { beforeAll, describe, expect, it } from "vitest";

import { getDailyPool, getTodaysDaily } from "../daily-pool";
import { CURATED_SNIPPETS_LIST, type Snippet } from "../snippets";

describe("getDailyPool", () => {
    let pool: Snippet[];

    beforeAll(async () => {
        pool = await getDailyPool();
    });

    it("is non-empty", () => {
        expect(pool.length).toBeGreaterThan(0);
    });

    it("includes the committed curated snippets", () => {
        const poolIds = new Set(pool.map((s) => s.id));
        for (const curated of CURATED_SNIPPETS_LIST) {
            expect(poolIds.has(curated.id)).toBe(true);
        }
    });

    it("includes built-in snippets from every supported language", () => {
        const languages = new Set(pool.map((s) => s.language));
        expect(languages.has("javascript")).toBe(true);
        expect(languages.has("python")).toBe(true);
        expect(languages.has("java")).toBe(true);
        expect(languages.has("cpp")).toBe(true);
    });

    it("excludes AI drills (no problemId starts with ai-drill-)", () => {
        expect(pool.some((s) => s.problemId.startsWith("ai-drill-"))).toBe(false);
    });

    it("is sorted by id so it is stable across users", () => {
        const ids = pool.map((s) => s.id);
        const sorted = [...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        expect(ids).toEqual(sorted);
    });

    it("has no duplicate ids", () => {
        const ids = pool.map((s) => s.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it("returns a fresh array each call (no shared mutation surface)", async () => {
        const a = await getDailyPool();
        const b = await getDailyPool();
        expect(a).not.toBe(b);
        expect(a.map((s) => s.id)).toEqual(b.map((s) => s.id));
    });

    it("hands out copies, so mutating one caller's array cannot affect the next", async () => {
        const a = await getDailyPool();
        const originalLength = a.length;
        a.length = 0;
        const b = await getDailyPool();
        expect(b).toHaveLength(originalLength);
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

    // Pinned against the selection the synchronous implementation produced, so a
    // change to pool construction can never silently move everyone's daily.
    it("picks the same snippets it always has for known dates", async () => {
        expect((await getTodaysDaily("2025-06-15"))!.id).toBe("python:article-views-i");
        expect((await getTodaysDaily("2026-01-01"))!.id).toBe(
            "algo-java-src-main-java-com-thealgorithms-maths-collatzconjecture-java",
        );
        expect((await getTodaysDaily("2026-08-28"))!.id).toBe(
            "algo-python-data-structures-arrays-equilibrium-index-in-array-py",
        );
    });

    it("spreads across multiple dates", async () => {
        const dates = [
            "2025-06-15",
            "2025-06-16",
            "2025-06-17",
            "2025-06-18",
            "2025-06-19",
        ];
        const ids = await Promise.all(dates.map((d) => getTodaysDaily(d)));
        expect(new Set(ids.map((s) => s!.id)).size).toBeGreaterThan(1);
    });
});
