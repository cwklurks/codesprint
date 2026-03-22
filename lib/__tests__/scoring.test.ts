import { describe, it, expect } from "vitest";
import { computeMetrics, computePatternScore, createPatternScoreCalculator } from "../scoring";
import { tokenize } from "../tokenizer";

describe("computeMetrics", () => {
    it("returns zeroes for no time elapsed", () => {
        const result = computeMetrics({
            correctProgress: 0,
            elapsedMs: 0,
            totalTyped: 0,
        });
        expect(result.rawWpm).toBe(0);
        expect(result.adjustedWpm).toBe(0);
        expect(result.accuracy).toBe(1);
    });

    it("computes WPM correctly", () => {
        // 50 keystrokes in 1 minute = 10 raw WPM
        const result = computeMetrics({
            correctProgress: 50,
            elapsedMs: 60000,
            totalTyped: 50,
            totalKeystrokes: 50,
            correctKeystrokes: 50,
        });
        expect(result.rawWpm).toBe(10);
        expect(result.adjustedWpm).toBe(10);
        expect(result.accuracy).toBe(1);
    });

    it("computes accuracy with errors", () => {
        const result = computeMetrics({
            correctProgress: 40,
            elapsedMs: 60000,
            totalTyped: 50,
            totalKeystrokes: 50,
            correctKeystrokes: 45,
        });
        expect(result.accuracy).toBe(0.9);
    });
});

describe("computePatternScore", () => {
    it("returns 100 for no errors", () => {
        const content = "const x = 1;";
        const tokens = tokenize(content, "javascript");
        const score = computePatternScore({
            errorPositions: [],
            tokens,
            contentLength: content.length,
            language: "javascript",
        });
        expect(score).toBe(100);
    });

    it("returns lower score for errors on keywords", () => {
        const content = "const x = 1;";
        const tokens = tokenize(content, "javascript");

        // Error on a keyword character (index 0 = 'c' in 'const')
        const score = computePatternScore({
            errorPositions: [0],
            tokens,
            contentLength: content.length,
            language: "javascript",
        });
        expect(score).toBeLessThan(100);
        expect(score).toBeGreaterThan(0);
    });

    it("keyword errors have bigger impact than whitespace errors", () => {
        const content = "const x = 1;";
        const tokens = tokenize(content, "javascript");

        // Error on keyword char
        const keywordScore = computePatternScore({
            errorPositions: [0], // 'c' in const
            tokens,
            contentLength: content.length,
            language: "javascript",
        });

        // Error on whitespace char
        const whitespaceScore = computePatternScore({
            errorPositions: [5], // space after const
            tokens,
            contentLength: content.length,
            language: "javascript",
        });

        // Keyword error should result in lower score (higher weight penalty)
        expect(keywordScore).toBeLessThan(whitespaceScore);
    });

    it("returns 100 for empty tokens", () => {
        const score = computePatternScore({
            errorPositions: [0],
            tokens: [],
            contentLength: 5,
            language: "javascript",
        });
        expect(score).toBe(100);
    });
});

describe("createPatternScoreCalculator", () => {
    it("returns same result as direct computePatternScore", () => {
        const content = "const x = 1;";
        const tokens = tokenize(content, "javascript");
        const calculator = createPatternScoreCalculator({
            tokens,
            contentLength: content.length,
            language: "javascript",
        });
        const directScore = computePatternScore({
            errorPositions: [0, 3],
            tokens,
            contentLength: content.length,
            language: "javascript",
        });
        expect(calculator([0, 3])).toBe(directScore);
    });

    it("returns 100 for no errors", () => {
        const content = "def foo():";
        const tokens = tokenize(content, "python");
        const calculator = createPatternScoreCalculator({ tokens, contentLength: content.length, language: "python" });
        expect(calculator([])).toBe(100);
    });

    it("returns 100 for empty tokens", () => {
        const calculator = createPatternScoreCalculator({ tokens: [], contentLength: 5, language: "javascript" });
        expect(calculator([0, 1])).toBe(100);
    });
});
