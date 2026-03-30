import { describe, it, expect } from "vitest";
import { toSnippet, isAIDrill, isAcceptedAIDrill } from "@/lib/ai/snippet-bridge";
import type { CustomSnippetRecord } from "@/lib/storage/idb-store";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRecord(overrides: Partial<CustomSnippetRecord> = {}): CustomSnippetRecord {
    return {
        id: "test-id-123",
        title: "Test Drill",
        content: "def foo():\n    return 42\n\nprint(foo())",
        language: "python",
        createdAt: new Date().toISOString(),
        source: "ai",
        aiMetadata: {
            provider: "claude",
            model: "claude-sonnet-4-20250514",
            reasoning: "Testing",
            focusAreas: ["keyword"],
            weakPatternsInput: ["keywords"],
            tokensUsed: 100,
            costUsd: 0.001,
            accepted: true,
            difficulty: "medium",
            lengthCategory: "short",
        },
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// toSnippet
// ---------------------------------------------------------------------------

describe("toSnippet", () => {
    it("converts a CustomSnippetRecord to a Snippet", () => {
        const record = makeRecord();
        const snippet = toSnippet(record);

        expect(snippet.id).toBe("test-id-123");
        expect(snippet.title).toBe("Test Drill");
        expect(snippet.content).toBe(record.content);
        expect(snippet.language).toBe("python");
    });

    it("generates a stable problemId from the record id", () => {
        const record = makeRecord({ id: "abc-123" });
        const snippet = toSnippet(record);
        expect(snippet.problemId).toBe("ai-drill-abc-123");
    });

    it("calculates line count from content", () => {
        const content = "line1\nline2\nline3\nline4\nline5";
        const record = makeRecord({ content });
        const snippet = toSnippet(record);
        expect(snippet.lines).toBe(5);
    });

    it("uses aiMetadata.lengthCategory when available", () => {
        const record = makeRecord({
            aiMetadata: {
                provider: "claude",
                model: "test",
                reasoning: "test",
                focusAreas: [],
                weakPatternsInput: [],
                tokensUsed: 0,
                costUsd: 0,
                accepted: true,
                difficulty: "easy",
                lengthCategory: "long",
            },
        });
        const snippet = toSnippet(record);
        expect(snippet.lengthCategory).toBe("long");
    });

    it("classifies length from line count when aiMetadata has no lengthCategory", () => {
        const shortContent = "x = 1\ny = 2\nz = 3";
        const record = makeRecord({
            content: shortContent,
            aiMetadata: undefined,
        });
        const snippet = toSnippet(record);
        expect(snippet.lengthCategory).toBe("short");
    });

    it("classifies content with 20 lines as medium", () => {
        const lines = Array.from({ length: 20 }, (_, i) => `x${i} = ${i}`);
        const record = makeRecord({
            content: lines.join("\n"),
            aiMetadata: undefined,
        });
        const snippet = toSnippet(record);
        expect(snippet.lengthCategory).toBe("medium");
    });

    it("classifies content with 40 lines as long", () => {
        const lines = Array.from({ length: 40 }, (_, i) => `x${i} = ${i}`);
        const record = makeRecord({
            content: lines.join("\n"),
            aiMetadata: undefined,
        });
        const snippet = toSnippet(record);
        expect(snippet.lengthCategory).toBe("long");
    });

    it("uses aiMetadata.difficulty when available", () => {
        const record = makeRecord({
            aiMetadata: {
                provider: "openai",
                model: "gpt-4",
                reasoning: "test",
                focusAreas: [],
                weakPatternsInput: [],
                tokensUsed: 0,
                costUsd: 0,
                accepted: false,
                difficulty: "hard",
                lengthCategory: "medium",
            },
        });
        const snippet = toSnippet(record);
        expect(snippet.difficulty).toBe("hard");
    });

    it("defaults to medium difficulty when no aiMetadata", () => {
        const record = makeRecord({ aiMetadata: undefined });
        const snippet = toSnippet(record);
        expect(snippet.difficulty).toBe("medium");
    });

    it("handles single-line content", () => {
        const record = makeRecord({ content: "print('hello')" });
        const snippet = toSnippet(record);
        expect(snippet.lines).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// isAIDrill
// ---------------------------------------------------------------------------

describe("isAIDrill", () => {
    it("returns true for source 'ai'", () => {
        const record = makeRecord({ source: "ai" });
        expect(isAIDrill(record)).toBe(true);
    });

    it("returns false for source 'user'", () => {
        const record = makeRecord({ source: "user" });
        expect(isAIDrill(record)).toBe(false);
    });

    it("returns false for undefined source", () => {
        const record = makeRecord({ source: undefined });
        expect(isAIDrill(record)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// isAcceptedAIDrill
// ---------------------------------------------------------------------------

describe("isAcceptedAIDrill", () => {
    it("returns true for accepted AI drills", () => {
        const record = makeRecord({
            source: "ai",
            aiMetadata: {
                provider: "claude",
                model: "test",
                reasoning: "test",
                focusAreas: [],
                weakPatternsInput: [],
                tokensUsed: 0,
                costUsd: 0,
                accepted: true,
                difficulty: "medium",
                lengthCategory: "short",
            },
        });
        expect(isAcceptedAIDrill(record)).toBe(true);
    });

    it("returns false for unaccepted AI drills", () => {
        const record = makeRecord({
            source: "ai",
            aiMetadata: {
                provider: "claude",
                model: "test",
                reasoning: "test",
                focusAreas: [],
                weakPatternsInput: [],
                tokensUsed: 0,
                costUsd: 0,
                accepted: false,
                difficulty: "medium",
                lengthCategory: "short",
            },
        });
        expect(isAcceptedAIDrill(record)).toBe(false);
    });

    it("returns false for user source even with aiMetadata", () => {
        const record = makeRecord({ source: "user" });
        expect(isAcceptedAIDrill(record)).toBe(false);
    });

    it("returns false when aiMetadata is undefined", () => {
        const record = makeRecord({ source: "ai", aiMetadata: undefined });
        expect(isAcceptedAIDrill(record)).toBe(false);
    });
});
