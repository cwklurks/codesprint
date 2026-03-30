import { describe, it, expect } from "vitest";
import { buildPrompt, getStdlibAllowlist, isImportAllowed } from "@/lib/ai/prompt-builder";
import type { DrillRequest } from "@/lib/ai/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(overrides: Partial<DrillRequest> = {}): DrillRequest {
    return {
        language: "python",
        difficulty: "medium",
        lengthCategory: "medium",
        weakPatterns: [],
        targetTokenCategories: [],
        recentDrillTitles: [],
        userContext: {
            estimatedWpm: 40,
            estimatedAccuracy: 0.85,
            sessionCount: 5,
        },
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// getStdlibAllowlist
// ---------------------------------------------------------------------------

describe("getStdlibAllowlist", () => {
    it("returns a non-empty list for python", () => {
        const list = getStdlibAllowlist("python");
        expect(list.length).toBeGreaterThan(0);
        expect(list).toContain("collections");
        expect(list).toContain("itertools");
    });

    it("returns a non-empty list for java", () => {
        const list = getStdlibAllowlist("java");
        expect(list.length).toBeGreaterThan(0);
        expect(list).toContain("java.util");
    });

    it("returns a non-empty list for cpp", () => {
        const list = getStdlibAllowlist("cpp");
        expect(list.length).toBeGreaterThan(0);
        expect(list).toContain("vector");
        expect(list).toContain("string");
    });

    it("returns an empty list for javascript", () => {
        const list = getStdlibAllowlist("javascript");
        expect(list).toEqual([]);
    });

    it("returns a copy, not a reference", () => {
        const a = getStdlibAllowlist("python");
        const b = getStdlibAllowlist("python");
        expect(a).toEqual(b);
        a.push("MUTATED");
        expect(getStdlibAllowlist("python")).not.toContain("MUTATED");
    });
});

// ---------------------------------------------------------------------------
// isImportAllowed
// ---------------------------------------------------------------------------

describe("isImportAllowed", () => {
    it("allows a direct stdlib match for python", () => {
        expect(isImportAllowed("python", "collections")).toBe(true);
    });

    it("allows submodule imports via dot prefix for python", () => {
        expect(isImportAllowed("python", "collections.OrderedDict")).toBe(true);
    });

    it("rejects unknown modules for python", () => {
        expect(isImportAllowed("python", "flask")).toBe(false);
        expect(isImportAllowed("python", "requests")).toBe(false);
    });

    it("allows java.util and sub-packages for java", () => {
        expect(isImportAllowed("java", "java.util")).toBe(true);
        expect(isImportAllowed("java", "java.util.List")).toBe(true);
        expect(isImportAllowed("java", "java.util.stream.Collectors")).toBe(true);
    });

    it("rejects non-allowed java packages", () => {
        expect(isImportAllowed("java", "javax.servlet")).toBe(false);
        expect(isImportAllowed("java", "com.google.gson")).toBe(false);
    });

    it("allows stdlib headers for cpp", () => {
        expect(isImportAllowed("cpp", "vector")).toBe(true);
        expect(isImportAllowed("cpp", "algorithm")).toBe(true);
    });

    it("rejects non-stdlib headers for cpp", () => {
        expect(isImportAllowed("cpp", "boost")).toBe(false);
        expect(isImportAllowed("cpp", "pthread")).toBe(false);
    });

    it("rejects all imports for javascript", () => {
        expect(isImportAllowed("javascript", "fs")).toBe(false);
        expect(isImportAllowed("javascript", "lodash")).toBe(false);
        expect(isImportAllowed("javascript", "react")).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// buildPrompt
// ---------------------------------------------------------------------------

describe("buildPrompt", () => {
    it("returns systemPrompt and userPrompt strings", () => {
        const result = buildPrompt(makeRequest());
        expect(typeof result.systemPrompt).toBe("string");
        expect(typeof result.userPrompt).toBe("string");
        expect(result.systemPrompt.length).toBeGreaterThan(0);
        expect(result.userPrompt.length).toBeGreaterThan(0);
    });

    it("includes the language in the system prompt", () => {
        const result = buildPrompt(makeRequest({ language: "java" }));
        expect(result.systemPrompt).toContain("java");
    });

    it("includes stdlib allowlist info for python", () => {
        const result = buildPrompt(makeRequest({ language: "python" }));
        expect(result.systemPrompt).toContain("collections");
        expect(result.systemPrompt).toContain("Standard library imports are ALLOWED");
    });

    it("mentions no imports for javascript", () => {
        const result = buildPrompt(makeRequest({ language: "javascript" }));
        expect(result.systemPrompt).toContain("No imports allowed");
    });

    it("includes correct line range for short", () => {
        const result = buildPrompt(makeRequest({ lengthCategory: "short" }));
        expect(result.systemPrompt).toContain("3");
        expect(result.systemPrompt).toContain("10");
        expect(result.userPrompt).toContain("3-10");
    });

    it("includes correct line range for medium", () => {
        const result = buildPrompt(makeRequest({ lengthCategory: "medium" }));
        expect(result.systemPrompt).toContain("11");
        expect(result.systemPrompt).toContain("30");
        expect(result.userPrompt).toContain("11-30");
    });

    it("includes correct line range for long", () => {
        const result = buildPrompt(makeRequest({ lengthCategory: "long" }));
        expect(result.systemPrompt).toContain("31");
        expect(result.systemPrompt).toContain("60");
        expect(result.userPrompt).toContain("31-60");
    });

    it("includes difficulty in user prompt", () => {
        const result = buildPrompt(makeRequest({ difficulty: "hard" }));
        expect(result.userPrompt).toContain("hard");
    });

    it("includes target token categories in system prompt", () => {
        const result = buildPrompt(makeRequest({
            targetTokenCategories: ["keyword", "operator"],
        }));
        expect(result.systemPrompt).toContain("keyword");
        expect(result.systemPrompt).toContain("operator");
    });

    it("includes weak patterns in user prompt when provided", () => {
        const result = buildPrompt(makeRequest({
            weakPatterns: [
                { category: "keyword", errorCount: 5, totalTokens: 20, errorRate: 0.25, label: "Keywords" },
            ],
        }));
        expect(result.userPrompt).toContain("Keywords");
        expect(result.userPrompt).toContain("75% accuracy");
        expect(result.userPrompt).toContain("5 errors");
    });

    it("shows default focus when no weak patterns", () => {
        const result = buildPrompt(makeRequest({ weakPatterns: [] }));
        expect(result.userPrompt).toContain("Default focus");
    });

    it("includes user context in user prompt", () => {
        const result = buildPrompt(makeRequest({
            userContext: { estimatedWpm: 55, estimatedAccuracy: 0.92, sessionCount: 12 },
        }));
        expect(result.userPrompt).toContain("55");
        expect(result.userPrompt).toContain("92%");
        expect(result.userPrompt).toContain("12");
    });

    it("includes recent drill titles when provided", () => {
        const result = buildPrompt(makeRequest({
            recentDrillTitles: ["Binary Search", "Linked List Traversal"],
        }));
        expect(result.userPrompt).toContain("Binary Search");
        expect(result.userPrompt).toContain("Linked List Traversal");
    });

    it("shows 'None yet' when no recent drill titles", () => {
        const result = buildPrompt(makeRequest({ recentDrillTitles: [] }));
        expect(result.userPrompt).toContain("None yet");
    });

    it("uses balanced mix when no target categories", () => {
        const result = buildPrompt(makeRequest({ targetTokenCategories: [] }));
        expect(result.systemPrompt).toContain("balanced mix");
    });
});
