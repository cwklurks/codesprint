import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionRecord } from "@/lib/storage/session-history";

const mockSessions: SessionRecord[] = [];
vi.mock("@/lib/storage/session-history", () => ({
    getSessions: vi.fn(() => [...mockSessions]),
}));

import { aggregateCategoryErrorRates } from "../weak-pattern-trends";

function makeSession(overrides: Partial<SessionRecord> = {}): SessionRecord {
    return {
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        snippetId: "snip-1",
        language: "javascript",
        lengthCategory: "short",
        difficulty: "easy",
        wpm: 60,
        rawWpm: 65,
        accuracy: 0.95,
        elapsedMs: 10000,
        totalKeystrokes: 100,
        correctKeystrokes: 95,
        errorCount: 5,
        history: [],
        ...overrides,
    };
}

describe("aggregateCategoryErrorRates", () => {
    beforeEach(() => {
        mockSessions.length = 0;
    });

    it("returns all zero categories when no sessions have error data", () => {
        mockSessions.push(makeSession({ errors: undefined, snippetContent: undefined }));
        const rates = aggregateCategoryErrorRates([]);
        expect(rates.keyword.errors).toBe(0);
        expect(rates.keyword.totalChars).toBe(0);
        expect(rates.keyword.errorRate).toBe(0);
    });

    it("counts errors by tokenized category for a JS snippet", () => {
        const snippetContent = "const x = 1;";
        // tokenization: "const" keyword 0-5, " " ws 5-6, "x" ident 6-7, " " ws 7-8,
        // "=" op 8-9, " " ws 9-10, "1" literal 10-11, ";" delim 11-12
        const session = makeSession({
            language: "javascript",
            snippetContent,
            errors: [
                { expected: "c", got: "x", index: 0 },   // keyword
                { expected: "o", got: "x", index: 1 },   // keyword
                { expected: "=", got: "x", index: 8 },   // operator
            ],
        });
        const rates = aggregateCategoryErrorRates([session]);
        expect(rates.keyword.errors).toBe(2);
        expect(rates.operator.errors).toBe(1);
        expect(rates.delimiter.errors).toBe(0);
        expect(rates.keyword.totalChars).toBe(5);   // "const"
        expect(rates.operator.totalChars).toBe(1);  // "="
        expect(rates.keyword.errorRate).toBeCloseTo(2 / 5, 3);
        expect(rates.operator.errorRate).toBeCloseTo(1 / 1, 3);
    });

    it("accumulates across multiple sessions", () => {
        const content = "if (x) {}";
        const s1 = makeSession({
            language: "javascript",
            snippetContent: content,
            errors: [{ expected: "i", got: "x", index: 0 }], // keyword
        });
        const s2 = makeSession({
            language: "javascript",
            snippetContent: content,
            errors: [{ expected: "f", got: "x", index: 1 }], // keyword
        });
        const rates = aggregateCategoryErrorRates([s1, s2]);
        expect(rates.keyword.errors).toBe(2);
        expect(rates.keyword.totalChars).toBe(4);  // "if" * 2 sessions
    });

    it("skips sessions missing errors or snippetContent", () => {
        const s1 = makeSession({ errors: undefined, snippetContent: "const x;" });
        const s2 = makeSession({
            errors: [{ expected: "a", got: "b", index: 0 }],
            snippetContent: undefined,
        });
        const rates = aggregateCategoryErrorRates([s1, s2]);
        expect(rates.keyword.errors).toBe(0);
        expect(rates.keyword.totalChars).toBe(0);
    });
});
