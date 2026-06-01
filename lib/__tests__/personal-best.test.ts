import { describe, it, expect } from "vitest";
import { isNewBest, bestDelta } from "../personal-best";

describe("isNewBest", () => {
    it("is a new best when current strictly exceeds the prior best", () => {
        expect(isNewBest(80, 70)).toBe(true);
    });

    it("is not a new best when current equals the prior best", () => {
        expect(isNewBest(70, 70)).toBe(false);
    });

    it("is not a new best when current is below the prior best", () => {
        expect(isNewBest(60, 70)).toBe(false);
    });

    it("counts the first run as a best when there is no prior best (0)", () => {
        expect(isNewBest(40, 0)).toBe(true);
    });

    it("counts the first run as a best when the prior best is undefined", () => {
        expect(isNewBest(40, undefined)).toBe(true);
    });

    it("is not a best when both current and prior are 0", () => {
        expect(isNewBest(0, 0)).toBe(false);
    });
});

describe("bestDelta", () => {
    it("returns the rounded gain over the prior best", () => {
        expect(bestDelta(80, 70)).toBe(10);
    });

    it("rounds fractional gains to the nearest whole wpm", () => {
        expect(bestDelta(80.6, 70.1)).toBe(11);
        expect(bestDelta(80.2, 70.1)).toBe(10);
    });

    it("returns the full rounded value when there is no prior best", () => {
        expect(bestDelta(42.4, 0)).toBe(42);
        expect(bestDelta(42.4, undefined)).toBe(42);
    });

    it("never returns a negative delta", () => {
        expect(bestDelta(50, 70)).toBe(0);
        expect(bestDelta(70, 70)).toBe(0);
    });
});
