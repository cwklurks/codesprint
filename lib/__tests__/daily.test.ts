import { describe, expect, it } from "vitest";

import {
    formatDailyShare,
    getDailyNumber,
    getDateForDailyNumber,
    pickDailySnippet,
} from "../daily";
import { getSiteUrl } from "../site";
import type { Snippet } from "../snippets";

const FILLED = "█";
const EMPTY = "░";

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

describe("getDateForDailyNumber", () => {
    it("maps daily #1 back to the epoch 2024-01-01", () => {
        expect(getDateForDailyNumber(1)).toBe("2024-01-01");
    });

    it("is the exact inverse of getDailyNumber across many dates", () => {
        const dates = [
            "2024-01-01",
            "2024-01-31",
            "2024-02-01",
            "2024-02-29", // leap day
            "2024-03-01",
            "2024-12-31",
            "2025-01-01",
            "2025-06-15",
            "2026-06-11",
            "2030-11-30",
        ];
        for (const date of dates) {
            const n = getDailyNumber(date);
            expect(getDateForDailyNumber(n)).toBe(date);
        }
    });

    it("roundtrips from number to date and back across boundaries", () => {
        for (let n = 1; n <= 1500; n++) {
            const date = getDateForDailyNumber(n);
            expect(getDailyNumber(date)).toBe(n);
        }
    });

    it("returns zero-padded YYYY-MM-DD strings", () => {
        // #32 is 2024-02-01 (31 days after the epoch)
        expect(getDateForDailyNumber(32)).toBe("2024-02-01");
        expect(getDateForDailyNumber(32)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("advances by one calendar day per increment", () => {
        expect(getDateForDailyNumber(1)).toBe("2024-01-01");
        expect(getDateForDailyNumber(2)).toBe("2024-01-02");
        expect(getDateForDailyNumber(3)).toBe("2024-01-03");
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

    it("emits exactly four lines", () => {
        const out = formatDailyShare(baseOpts);
        expect(out.split("\n")).toHaveLength(4);
    });

    it("line 1 is the title with daily number and language code", () => {
        const lines = formatDailyShare(baseOpts).split("\n");
        expect(lines[0]).toBe("CodeSprint #532 js");
    });

    it("maps language names to short codes", () => {
        expect(formatDailyShare({ ...baseOpts, language: "javascript" }).split("\n")[0]).toBe(
            "CodeSprint #532 js"
        );
        expect(formatDailyShare({ ...baseOpts, language: "python" }).split("\n")[0]).toBe(
            "CodeSprint #532 py"
        );
        expect(formatDailyShare({ ...baseOpts, language: "java" }).split("\n")[0]).toBe(
            "CodeSprint #532 java"
        );
        expect(formatDailyShare({ ...baseOpts, language: "cpp" }).split("\n")[0]).toBe(
            "CodeSprint #532 cpp"
        );
    });

    it("falls back to the first four chars for unknown languages", () => {
        expect(formatDailyShare({ ...baseOpts, language: "ruby" }).split("\n")[0]).toBe(
            "CodeSprint #532 ruby"
        );
        expect(formatDailyShare({ ...baseOpts, language: "typescript" }).split("\n")[0]).toBe(
            "CodeSprint #532 type"
        );
    });

    it("line 2 bar is always exactly 15 cells", () => {
        for (const wpm of [0, 13, 50, 87, 100, 150, 400]) {
            const bar = formatDailyShare({ ...baseOpts, wpm }).split("\n")[1];
            const cells = [...bar].filter((c) => c === FILLED || c === EMPTY);
            expect(cells).toHaveLength(15);
        }
    });

    it("line 2 fill math: 0 wpm -> 0 filled", () => {
        const line = formatDailyShare({ ...baseOpts, wpm: 0 }).split("\n")[1];
        expect(line).toBe(`${EMPTY.repeat(15)} 0 wpm`);
    });

    it("line 2 fill math: 50 wpm -> 8 filled (round half up)", () => {
        const line = formatDailyShare({ ...baseOpts, wpm: 50 }).split("\n")[1];
        expect(line).toBe(`${FILLED.repeat(8)}${EMPTY.repeat(7)} 50 wpm`);
    });

    it("line 2 fill math: 100 wpm -> 15 filled", () => {
        const line = formatDailyShare({ ...baseOpts, wpm: 100 }).split("\n")[1];
        expect(line).toBe(`${FILLED.repeat(15)} 100 wpm`);
    });

    it("line 2 fill math: 150 wpm caps at 15 filled and shows real wpm", () => {
        const line = formatDailyShare({ ...baseOpts, wpm: 150 }).split("\n")[1];
        expect(line).toBe(`${FILLED.repeat(15)} 150 wpm`);
    });

    it("line 2 rounds the wpm to an int", () => {
        const line = formatDailyShare({ ...baseOpts, wpm: 86.6 }).split("\n")[1];
        expect(line.endsWith(" 87 wpm")).toBe(true);
    });

    it("line 3 renders accuracy percent and streak with the flame", () => {
        const lines = formatDailyShare(baseOpts).split("\n");
        expect(lines[2]).toBe("96% acc · 🔥 12");
    });

    it("rounds accuracy 0.984 to 98", () => {
        const lines = formatDailyShare({ ...baseOpts, accuracy: 0.984 }).split("\n");
        expect(lines[2]).toBe("98% acc · 🔥 12");
    });

    it("line 4 is the daily url with all params", () => {
        const lines = formatDailyShare(baseOpts).split("\n");
        expect(lines[3]).toBe(`${getSiteUrl()}/daily/532?w=87&a=96&s=12&l=js`);
    });

    it("line 4 carries the rounded wpm/accuracy and short language code", () => {
        const lines = formatDailyShare({
            ...baseOpts,
            wpm: 86.6,
            accuracy: 0.984,
            language: "python",
        }).split("\n");
        expect(lines[3]).toBe(`${getSiteUrl()}/daily/532?w=87&a=98&s=12&l=py`);
    });

    it("contains exactly one emoji total (the flame)", () => {
        const out = formatDailyShare(baseOpts);
        const emoji = [...out].filter((ch) => /\p{Extended_Pictographic}/u.test(ch));
        expect(emoji).toEqual(["🔥"]);
    });

    it("still accepts the optional pattern score for API compatibility without rendering it", () => {
        const withScore = formatDailyShare({ ...baseOpts, patternScore: 73 });
        const without = formatDailyShare(baseOpts);
        expect(withScore).toBe(without);
        expect(withScore).not.toContain("73");
        expect(withScore).not.toContain("🧩");
    });

    it("never leaks snippet content", () => {
        const picked = pickDailySnippet(baseOpts.dateStr, POOL)!;
        const out = formatDailyShare(baseOpts);
        expect(out).not.toContain(picked.content);
        expect(out).not.toContain("secret content");
        expect(out).not.toContain("const x = 1");
    });
});
