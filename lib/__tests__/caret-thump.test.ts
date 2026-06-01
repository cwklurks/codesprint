import { describe, expect, it } from "vitest";
import { shouldThumpCaret } from "../code-panel";

describe("shouldThumpCaret", () => {
    it("thumps when the cursor advances forward onto a newly-correct char", () => {
        // prev cursor at 3, now at 4, char at index 3 was typed correctly
        expect(shouldThumpCaret(3, 4, new Set())).toBe(true);
    });

    it("does not thump when the cursor moves backward (deletion)", () => {
        expect(shouldThumpCaret(4, 3, new Set())).toBe(false);
    });

    it("does not thump when the cursor does not move", () => {
        expect(shouldThumpCaret(4, 4, new Set())).toBe(false);
    });

    it("does not thump when the advance landed on a wrong char", () => {
        // the char just consumed (index 3) is flagged wrong, so it was not a clean advance
        expect(shouldThumpCaret(3, 4, new Set([3]))).toBe(false);
    });

    it("thumps on a multi-step forward jump only when the consumed char is correct", () => {
        // jumping from 0 to 2 (e.g. auto-indent); char at index 1 (prev of new) is the one consumed
        expect(shouldThumpCaret(0, 2, new Set())).toBe(true);
        expect(shouldThumpCaret(0, 2, new Set([1]))).toBe(false);
    });

    it("does not thump from a negative or zero-origin no-op", () => {
        expect(shouldThumpCaret(0, 0, new Set())).toBe(false);
    });
});
