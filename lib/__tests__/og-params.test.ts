import { describe, expect, it } from "vitest";

import { BAR_CELLS, barFilledCells, langCode, parseDay, parseShareParams } from "../og-params";

describe("langCode", () => {
    it("maps known languages to short codes", () => {
        expect(langCode("javascript")).toBe("js");
        expect(langCode("python")).toBe("py");
        expect(langCode("java")).toBe("java");
        expect(langCode("cpp")).toBe("cpp");
    });

    it("falls back to the first four chars for unknown languages", () => {
        expect(langCode("typescript")).toBe("type");
        expect(langCode("rust")).toBe("rust");
        expect(langCode("go")).toBe("go");
        expect(langCode("ruby")).toBe("ruby");
    });

    it("is case-insensitive for the first-four-chars fallback", () => {
        expect(langCode("TypeScript")).toBe("type");
    });
});

describe("parseDay", () => {
    it("accepts positive integers within range", () => {
        expect(parseDay("1")).toBe(1);
        expect(parseDay("532")).toBe(532);
        expect(parseDay("50000")).toBe(50000);
    });

    it("rejects non-numeric input", () => {
        expect(parseDay("abc")).toBeNull();
        expect(parseDay("")).toBeNull();
        expect(parseDay("12x")).toBeNull();
        expect(parseDay(undefined)).toBeNull();
    });

    it("rejects zero and negatives", () => {
        expect(parseDay("0")).toBeNull();
        expect(parseDay("-1")).toBeNull();
        expect(parseDay("-532")).toBeNull();
    });

    it("rejects values above the 50000 ceiling", () => {
        expect(parseDay("50001")).toBeNull();
        expect(parseDay("999999")).toBeNull();
    });

    it("rejects non-integer numeric strings", () => {
        expect(parseDay("1.5")).toBeNull();
        expect(parseDay("3.0")).toBeNull();
    });
});

describe("barFilledCells", () => {
    it("is 0 at 0 wpm and full at 100+", () => {
        expect(barFilledCells(0)).toBe(0);
        expect(barFilledCells(100)).toBe(BAR_CELLS);
        expect(barFilledCells(150)).toBe(BAR_CELLS);
    });

    it("rounds the proportion to the nearest cell", () => {
        // 50/100 * 15 = 7.5 -> rounds to 8
        expect(barFilledCells(50)).toBe(8);
        // 78/100 * 15 = 11.7 -> 12
        expect(barFilledCells(78)).toBe(12);
        // 10/100 * 15 = 1.5 -> 2
        expect(barFilledCells(10)).toBe(2);
    });

    it("never exceeds the cell range", () => {
        for (const wpm of [-50, 0, 33, 99, 100, 400, 9999]) {
            const cells = barFilledCells(wpm);
            expect(cells).toBeGreaterThanOrEqual(0);
            expect(cells).toBeLessThanOrEqual(BAR_CELLS);
        }
    });
});

describe("parseShareParams", () => {
    it("passes a fully valid param set through unchanged", () => {
        const result = parseShareParams({ w: "78", a: "98", s: "12", l: "js" });
        expect(result).toEqual({ w: 78, a: 98, s: 12, l: "js" });
    });

    it("accepts every allowed language code", () => {
        expect(parseShareParams({ l: "js" }).l).toBe("js");
        expect(parseShareParams({ l: "py" }).l).toBe("py");
        expect(parseShareParams({ l: "java" }).l).toBe("java");
        expect(parseShareParams({ l: "cpp" }).l).toBe("cpp");
    });

    it("drops an unrecognized language code", () => {
        expect(parseShareParams({ l: "rust" }).l).toBeUndefined();
        expect(parseShareParams({ l: "javascript" }).l).toBeUndefined();
        expect(parseShareParams({ l: "JS" }).l).toBeUndefined();
    });

    it("drops out-of-range wpm but keeps valid ones", () => {
        expect(parseShareParams({ w: "0" }).w).toBe(0);
        expect(parseShareParams({ w: "400" }).w).toBe(400);
        expect(parseShareParams({ w: "401" }).w).toBeUndefined();
        expect(parseShareParams({ w: "-1" }).w).toBeUndefined();
        expect(parseShareParams({ w: "abc" }).w).toBeUndefined();
    });

    it("drops out-of-range accuracy but keeps valid ones", () => {
        expect(parseShareParams({ a: "0" }).a).toBe(0);
        expect(parseShareParams({ a: "100" }).a).toBe(100);
        expect(parseShareParams({ a: "101" }).a).toBeUndefined();
        expect(parseShareParams({ a: "-5" }).a).toBeUndefined();
    });

    it("drops out-of-range streak but keeps valid ones", () => {
        expect(parseShareParams({ s: "0" }).s).toBe(0);
        expect(parseShareParams({ s: "10000" }).s).toBe(10000);
        expect(parseShareParams({ s: "10001" }).s).toBeUndefined();
        expect(parseShareParams({ s: "-1" }).s).toBeUndefined();
    });

    it("drops non-integer numeric values", () => {
        expect(parseShareParams({ w: "78.5" }).w).toBeUndefined();
        expect(parseShareParams({ a: "98.2" }).a).toBeUndefined();
        expect(parseShareParams({ s: "3.5" }).s).toBeUndefined();
    });

    it("returns an empty object when nothing is provided", () => {
        expect(parseShareParams({})).toEqual({});
    });

    it("keeps valid fields while dropping invalid ones in the same set", () => {
        const result = parseShareParams({ w: "78", a: "999", s: "12", l: "nope" });
        expect(result).toEqual({ w: 78, s: 12 });
    });

    it("tolerates array-valued search params by ignoring them", () => {
        const result = parseShareParams({ w: ["78", "99"] as unknown as string });
        expect(result.w).toBeUndefined();
    });

    it("does not mutate the input object", () => {
        const input = { w: "78", a: "98", s: "12", l: "js" };
        const snapshot = { ...input };
        parseShareParams(input);
        expect(input).toEqual(snapshot);
    });
});
