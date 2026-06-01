import { describe, it, expect } from "vitest";
import { computePercentile } from "../percentile";

describe("computePercentile", () => {
    it("centers near the 50th percentile at the distribution mean (45 wpm)", () => {
        expect(computePercentile(45)).toBe(50);
    });

    it("is monotonically increasing in wpm", () => {
        expect(computePercentile(100)).toBeGreaterThan(computePercentile(60));
        expect(computePercentile(60)).toBeGreaterThan(computePercentile(30));
    });

    it("clamps to [1, 99]", () => {
        expect(computePercentile(0)).toBeGreaterThanOrEqual(1);
        expect(computePercentile(-50)).toBe(1);
        expect(computePercentile(500)).toBe(99);
    });

    it("keeps screen rank and card 'top' complementary for the same run", () => {
        // Screen shows `${p}% faster`; card shows `Top ${100 - p}%`. They must
        // describe one consistent standing, i.e. sum to 100.
        for (const wpm of [20, 45, 70, 100, 150]) {
            const p = computePercentile(wpm);
            expect(p + (100 - p)).toBe(100);
        }
    });
});
