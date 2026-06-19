import { describe, it, expect } from "vitest";
import { generateTextSummary, type ShareCardData } from "../share-card";
import { getSiteHost } from "../site";

describe("generateTextSummary", () => {
    it("generates a formatted text summary", () => {
        const data: ShareCardData = {
            wpm: 65,
            rawWpm: 72,
            accuracy: 0.95,
            patternScore: 88,
            snippetTitle: "Two Sum",
            language: "python",
            difficulty: "easy",
            timeMs: 45000,
            history: [],
        };

        const result = generateTextSummary(data);
        expect(result).toContain("CodeSprint");
        expect(result).toContain("65 WPM");
        expect(result).toContain("95% accuracy");
        expect(result).toContain("Pattern: 88/100");
        expect(result).toContain("PYTHON");
        expect(result).toContain(getSiteHost());
    });

    it("omits pattern score when undefined", () => {
        const data: ShareCardData = {
            wpm: 50,
            rawWpm: 57,
            accuracy: 0.90,
            snippetTitle: "Array Sort",
            language: "javascript",
            difficulty: "medium",
            timeMs: 30000,
            history: [],
        };

        const result = generateTextSummary(data);
        expect(result).not.toContain("Pattern:");
    });
});
