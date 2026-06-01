import { describe, expect, it } from "vitest";

import { formatDailyShare, getDailyNumber, pickDailySnippet } from "../daily";
import type { Snippet } from "../snippets";

function makeSnippet(id: string, overrides: Partial<Snippet> = {}): Snippet {
    return {
        id,
        problemId: `problem:${id}`,
        title: `Title ${id}`,
        content: `// secret content for ${id}\nconst x = 1;`,
        language: "javascript",
        lengthCategory: "short",
        difficulty: "easy",
        lines: 2,
        ...overrides,
    };
}

const POOL: Snippet[] = [
    makeSnippet("c-third"),
    makeSnippet("a-first"),
    makeSnippet("b-second"),
    makeSnippet("d-fourth"),
    makeSnippet("e-fifth"),
];

describe("getDailyNumber", () => {
    it("is 1 on the epoch date 2024-01-01", () => {
        expect(getDailyNumber("2024-01-01")).toBe(1);
    });

    it("increments by exactly 1 per calendar day", () => {
        const a = getDailyNumber("2024-01-01");
        const b = getDailyNumber("2024-01-02");
        const c = getDailyNumber("2024-01-03");
        expect(b - a).toBe(1);
        expect(c - b).toBe(1);
    });

    it("is stable for the same date", () => {
        expect(getDailyNumber("2025-06-15")).toBe(getDailyNumber("2025-06-15"));
    });

    it("counts across month and year boundaries", () => {
        const jan31 = getDailyNumber("2024-01-31");
        const feb01 = getDailyNumber("2024-02-01");
        expect(feb01 - jan31).toBe(1);

        const dec31 = getDailyNumber("2024-12-31");
        const jan01 = getDailyNumber("2025-01-01");
        expect(jan01 - dec31).toBe(1);
    });
});

describe("pickDailySnippet", () => {
    it("returns null for an empty pool", () => {
        expect(pickDailySnippet("2025-06-15", [])).toBeNull();
    });

    it("is deterministic: same date + same pool => identical snippet id", () => {
        const first = pickDailySnippet("2025-06-15", POOL);
        const second = pickDailySnippet("2025-06-15", POOL);
        expect(first).not.toBeNull();
        expect(first!.id).toBe(second!.id);
    });

    it("does not depend on input ordering", () => {
        const shuffled = [...POOL].reverse();
        const fromOrdered = pickDailySnippet("2025-06-15", POOL);
        const fromShuffled = pickDailySnippet("2025-06-15", shuffled);
        expect(fromOrdered!.id).toBe(fromShuffled!.id);
    });

    it("does not mutate the input array", () => {
        const before = POOL.map((s) => s.id);
        pickDailySnippet("2025-06-15", POOL);
        expect(POOL.map((s) => s.id)).toEqual(before);
    });

    it("returns a snippet from the pool", () => {
        const picked = pickDailySnippet("2025-06-15", POOL);
        expect(POOL.some((s) => s.id === picked!.id)).toBe(true);
    });

    it("spreads across the pool: several dates are not all identical", () => {
        const dates = [
            "2025-06-15",
            "2025-06-16",
            "2025-06-17",
            "2025-06-18",
            "2025-06-19",
            "2025-06-20",
            "2025-06-21",
            "2025-06-22",
        ];
        const ids = dates.map((d) => pickDailySnippet(d, POOL)!.id);
        const distinct = new Set(ids);
        expect(distinct.size).toBeGreaterThan(1);
    });
});

describe("formatDailyShare", () => {
    const baseOpts = {
        dateStr: "2025-06-15",
        dayNumber: 532,
        wpm: 87,
        accuracy: 0.964,
        streak: 12,
        language: "javascript",
    };

    it("includes the daily number in the title", () => {
        const out = formatDailyShare(baseOpts);
        expect(out).toContain("CodeSprint Daily #532");
    });

    it("includes wpm", () => {
        const out = formatDailyShare(baseOpts);
        expect(out).toContain("87");
    });

    it("includes accuracy as a rounded percentage", () => {
        const out = formatDailyShare(baseOpts);
        expect(out).toContain("96%");
    });

    it("includes the streak with a flame emoji", () => {
        const out = formatDailyShare(baseOpts);
        expect(out).toContain("12");
        expect(out).toContain("🔥");
    });

    it("includes the optional pattern score when provided", () => {
        const out = formatDailyShare({ ...baseOpts, patternScore: 73 });
        expect(out).toContain("73");
    });

    it("does not require the pattern score", () => {
        const out = formatDailyShare(baseOpts);
        expect(typeof out).toBe("string");
        expect(out.length).toBeGreaterThan(0);
    });

    it("includes the app name in a footer but no live url", () => {
        const out = formatDailyShare(baseOpts);
        expect(out).toContain("CodeSprint");
        expect(out).not.toMatch(/https?:\/\//);
    });

    it("never leaks snippet content", () => {
        const picked = pickDailySnippet(baseOpts.dateStr, POOL)!;
        const out = formatDailyShare(baseOpts);
        expect(out).not.toContain(picked.content);
        expect(out).not.toContain("secret content");
        expect(out).not.toContain("const x = 1");
    });
});
