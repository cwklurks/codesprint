import { describe, it, expect } from "vitest";
import { validateDrillResponse } from "@/lib/ai/response-parser";
import type { DrillRequest, DrillResponse } from "@/lib/ai/types";

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

function makeValidResponse(overrides: Partial<DrillResponse> = {}): DrillResponse {
    // 15 lines: well within medium range (11-30 +/- 6 tolerance)
    const content = [
        "def binary_search(arr, target):",
        "    low = 0",
        "    high = len(arr) - 1",
        "    while low <= high:",
        "        mid = (low + high) // 2",
        "        if arr[mid] == target:",
        "            return mid",
        "        elif arr[mid] < target:",
        "            low = mid + 1",
        "        else:",
        "            high = mid - 1",
        "    return -1",
        "",
        "result = binary_search([1, 3, 5, 7, 9], 5)",
        "print(result)",
    ].join("\n");

    return {
        title: "Binary Search",
        content,
        explanation: "Implements binary search on a sorted array.",
        focusAreas: ["keyword", "operator"],
        reasoning: "User struggles with comparison operators.",
        estimatedDifficulty: "medium",
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

describe("validateDrillResponse", () => {
    describe("schema validation", () => {
        it("accepts a valid response", () => {
            const result = validateDrillResponse(makeValidResponse(), makeRequest());
            expect(result.valid).toBe(true);
        });

        it("rejects null", () => {
            const result = validateDrillResponse(null, makeRequest());
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.code).toBe("SCHEMA_ERROR");
            }
        });

        it("rejects undefined", () => {
            const result = validateDrillResponse(undefined, makeRequest());
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.code).toBe("SCHEMA_ERROR");
            }
        });

        it("rejects missing required fields", () => {
            const result = validateDrillResponse({ title: "Test" }, makeRequest());
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.code).toBe("SCHEMA_ERROR");
            }
        });

        it("rejects invalid estimatedDifficulty value", () => {
            const result = validateDrillResponse(
                { ...makeValidResponse(), estimatedDifficulty: "impossible" },
                makeRequest(),
            );
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.code).toBe("SCHEMA_ERROR");
            }
        });

        it("rejects when focusAreas is not an array", () => {
            const result = validateDrillResponse(
                { ...makeValidResponse(), focusAreas: "keywords" },
                makeRequest(),
            );
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.code).toBe("SCHEMA_ERROR");
            }
        });
    });

    // -----------------------------------------------------------------------
    // Line count validation
    // -----------------------------------------------------------------------

    describe("line count validation", () => {
        it("accepts content within short range", () => {
            const content = "x = 1\ny = 2\nz = 3\nprint(x + y + z)";
            const response = makeValidResponse({ content });
            const result = validateDrillResponse(response, makeRequest({ lengthCategory: "short" }));
            expect(result.valid).toBe(true);
        });

        it("rejects too few lines for medium", () => {
            const content = "x = 1";
            const response = makeValidResponse({ content });
            const result = validateDrillResponse(response, makeRequest({ lengthCategory: "medium" }));
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.code).toBe("LINE_COUNT");
            }
        });

        it("rejects too many lines for short", () => {
            // 20 lines: outside short's max of 10 + tolerance of 2 = 12
            const lines = Array.from({ length: 20 }, (_, i) => `x${i} = ${i}`);
            const content = lines.join("\n");
            const response = makeValidResponse({ content });
            const result = validateDrillResponse(response, makeRequest({ lengthCategory: "short" }));
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.code).toBe("LINE_COUNT");
            }
        });

        it("allows tolerance margin for medium category", () => {
            // medium min is 11, tolerance is 6, so effective min is 5
            const lines = Array.from({ length: 6 }, (_, i) => `x${i} = ${i}`);
            const content = lines.join("\n");
            const response = makeValidResponse({ content });
            const result = validateDrillResponse(response, makeRequest({ lengthCategory: "medium" }));
            expect(result.valid).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // Import validation
    // -----------------------------------------------------------------------

    describe("import validation", () => {
        it("allows stdlib imports for python", () => {
            const content = [
                "from collections import defaultdict",
                "d = defaultdict(int)",
                "d['a'] += 1",
                "d['b'] += 2",
                "print(dict(d))",
            ].join("\n");
            const response = makeValidResponse({ content });
            const result = validateDrillResponse(response, makeRequest({ language: "python", lengthCategory: "short" }));
            expect(result.valid).toBe(true);
        });

        it("rejects third-party imports for python", () => {
            const content = [
                "import flask",
                "app = flask.Flask(__name__)",
                "print(app)",
                "x = 1",
                "y = 2",
            ].join("\n");
            const response = makeValidResponse({ content });
            const result = validateDrillResponse(response, makeRequest({ language: "python", lengthCategory: "short" }));
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.code).toBe("IMPORT_VIOLATION");
                expect(result.reason).toContain("flask");
            }
        });

        it("rejects all imports for javascript", () => {
            const content = [
                "import React from 'react';",
                "const x = 1;",
                "const y = 2;",
                "console.log(x + y);",
            ].join("\n");
            const response = makeValidResponse({ content });
            const result = validateDrillResponse(response, makeRequest({ language: "javascript", lengthCategory: "short" }));
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.code).toBe("IMPORT_VIOLATION");
            }
        });

        it("rejects require() for javascript", () => {
            const content = [
                "const fs = require('fs');",
                "const data = fs.readFileSync('file.txt');",
                "console.log(data);",
            ].join("\n");
            const response = makeValidResponse({ content });
            const result = validateDrillResponse(response, makeRequest({ language: "javascript", lengthCategory: "short" }));
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.code).toBe("IMPORT_VIOLATION");
            }
        });

        it("allows stdlib includes for cpp", () => {
            const content = [
                "#include <vector>",
                "#include <algorithm>",
                "int main() {",
                "    std::vector<int> v = {3, 1, 2};",
                "    std::sort(v.begin(), v.end());",
                "    return 0;",
                "}",
            ].join("\n");
            const response = makeValidResponse({ content });
            const result = validateDrillResponse(response, makeRequest({ language: "cpp", lengthCategory: "short" }));
            expect(result.valid).toBe(true);
        });

        it("rejects local headers for cpp", () => {
            const content = [
                '#include "myheader.h"',
                "int main() {",
                "    return 0;",
                "}",
            ].join("\n");
            const response = makeValidResponse({ content });
            const result = validateDrillResponse(response, makeRequest({ language: "cpp", lengthCategory: "short" }));
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.code).toBe("IMPORT_VIOLATION");
            }
        });

        it("allows stdlib imports for java", () => {
            const content = [
                "import java.util.List;",
                "import java.util.ArrayList;",
                "public class Main {",
                "    public static void main(String[] args) {",
                "        List<String> list = new ArrayList<>();",
                "        list.add(\"hello\");",
                "        System.out.println(list);",
                "    }",
                "}",
            ].join("\n");
            const response = makeValidResponse({ content });
            const result = validateDrillResponse(response, makeRequest({ language: "java", lengthCategory: "short" }));
            expect(result.valid).toBe(true);
        });

        it("rejects third-party imports for java", () => {
            const content = [
                "import com.google.gson.Gson;",
                "public class Main {",
                "    public static void main(String[] args) {",
                "        Gson gson = new Gson();",
                "        System.out.println(gson);",
                "    }",
                "}",
            ].join("\n");
            const response = makeValidResponse({ content });
            const result = validateDrillResponse(response, makeRequest({ language: "java", lengthCategory: "short" }));
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.code).toBe("IMPORT_VIOLATION");
            }
        });
    });

    // -----------------------------------------------------------------------
    // Delimiter balance validation
    // -----------------------------------------------------------------------

    describe("delimiter balance validation", () => {
        it("accepts balanced delimiters", () => {
            const content = [
                "def foo(a, b):",
                "    result = [a + b]",
                "    data = {'key': result}",
                "    return data",
                "print(foo(1, 2))",
            ].join("\n");
            const response = makeValidResponse({ content });
            const result = validateDrillResponse(response, makeRequest({ lengthCategory: "short" }));
            expect(result.valid).toBe(true);
        });

        it("rejects unbalanced braces", () => {
            const content = [
                "function foo() {",
                "    const x = 1;",
                "    const y = 2;",
                "    return x + y;",
                "// missing closing brace",
            ].join("\n");
            const response = makeValidResponse({ content });
            const result = validateDrillResponse(response, makeRequest({ language: "javascript", lengthCategory: "short" }));
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.code).toBe("DELIMITER_IMBALANCE");
            }
        });

        it("rejects unbalanced parentheses", () => {
            const content = [
                "def foo(a, b:",
                "    return a + b",
                "print(foo(1, 2))",
            ].join("\n");
            const response = makeValidResponse({ content });
            const result = validateDrillResponse(response, makeRequest({ lengthCategory: "short" }));
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.code).toBe("DELIMITER_IMBALANCE");
            }
        });

        it("ignores delimiters inside strings", () => {
            const content = [
                "x = 'hello {'",
                "y = 'world }'",
                "print(x + y)",
            ].join("\n");
            const response = makeValidResponse({ content });
            const result = validateDrillResponse(response, makeRequest({ lengthCategory: "short" }));
            expect(result.valid).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // Dedup validation
    // -----------------------------------------------------------------------

    describe("dedup validation", () => {
        it("accepts when no existing drills", () => {
            const result = validateDrillResponse(makeValidResponse(), makeRequest(), []);
            expect(result.valid).toBe(true);
        });

        it("accepts sufficiently different drills", () => {
            const existing: DrillResponse = {
                title: "Linked List",
                content: "class Node:\n    def __init__(self, val):\n        self.val = val\n        self.next = None\n\ndef traverse(head):\n    current = head\n    while current:\n        print(current.val)\n        current = current.next\n\nnode = Node(1)\nnode.next = Node(2)\ntraverse(node)",
                explanation: "Linked list traversal",
                focusAreas: ["keyword"],
                reasoning: "Test",
                estimatedDifficulty: "easy",
            };
            const result = validateDrillResponse(makeValidResponse(), makeRequest(), [existing]);
            expect(result.valid).toBe(true);
        });

        it("rejects nearly identical content", () => {
            const response = makeValidResponse();
            // Same content with trivial variation
            const existing: DrillResponse = {
                ...response,
                title: "Binary Search Copy",
            };
            const result = validateDrillResponse(response, makeRequest(), [existing]);
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.code).toBe("DEDUP_VIOLATION");
            }
        });
    });

    // -----------------------------------------------------------------------
    // Tokenizer validation
    // -----------------------------------------------------------------------

    describe("tokenizer validation", () => {
        it("accepts content that tokenizes successfully", () => {
            const result = validateDrillResponse(makeValidResponse(), makeRequest());
            expect(result.valid).toBe(true);
        });

        it("rejects content with only whitespace", () => {
            const content = "   \n   \n   \n   \n   ";
            const response = makeValidResponse({ content });
            const result = validateDrillResponse(response, makeRequest({ lengthCategory: "short" }));
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.code).toBe("NO_SCORABLE_TOKENS");
            }
        });
    });

    // -----------------------------------------------------------------------
    // Full pipeline
    // -----------------------------------------------------------------------

    describe("full pipeline", () => {
        it("runs all validations in order and returns first failure", () => {
            // This response fails schema validation (missing content)
            const result = validateDrillResponse(
                { title: "Test", explanation: "test", focusAreas: [], reasoning: "test", estimatedDifficulty: "easy" },
                makeRequest(),
            );
            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.code).toBe("SCHEMA_ERROR");
            }
        });

        it("passes a well-formed response through all layers", () => {
            const result = validateDrillResponse(makeValidResponse(), makeRequest());
            expect(result.valid).toBe(true);
        });
    });
});
