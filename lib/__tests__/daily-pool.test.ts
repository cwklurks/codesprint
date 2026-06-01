import { describe, expect, it } from "vitest";

import { getDailyPool, getTodaysDaily } from "../daily-pool";
import { CURATED_SNIPPETS_LIST } from "../snippets";

describe("getDailyPool", () => {
    const pool = getDailyPool();

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
        const sorted = [...ids].sort((a, b) => a.localeCompare(b));
        expect(ids).toEqual(sorted);
    });

    it("has no duplicate ids", () => {
        const ids = pool.map((s) => s.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it("returns a fresh array each call (no shared mutation surface)", () => {
        const a = getDailyPool();
        const b = getDailyPool();
        expect(a).not.toBe(b);
        expect(a.map((s) => s.id)).toEqual(b.map((s) => s.id));
    });
});

describe("getTodaysDaily", () => {
    it("is deterministic for a given date", () => {
        const first = getTodaysDaily("2025-06-15");
        const second = getTodaysDaily("2025-06-15");
        expect(first).not.toBeNull();
        expect(first!.id).toBe(second!.id);
    });

    it("returns a snippet that exists in the daily pool", () => {
        const pool = getDailyPool();
        const picked = getTodaysDaily("2025-06-15");
        expect(pool.some((s) => s.id === picked!.id)).toBe(true);
    });

    it("spreads across multiple dates", () => {
        const dates = [
            "2025-06-15",
            "2025-06-16",
            "2025-06-17",
            "2025-06-18",
            "2025-06-19",
        ];
        const ids = dates.map((d) => getTodaysDaily(d)!.id);
        expect(new Set(ids).size).toBeGreaterThan(1);
    });
});
