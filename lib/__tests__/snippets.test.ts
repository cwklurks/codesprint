import { describe, it, expect } from "vitest";
import {
    normalizeDataset,
    buildProblemsFromSnippets,
    getProblems,
    getProblemSnippets,
    getSnippet,
    getSnippetVarietyScore,
    getSnippetVarianceTag,
    CURATED_SNIPPETS_LIST,
    type Snippet,
} from "../snippets";

describe("CURATED_SNIPPETS_LIST", () => {
    it("has at least one snippet", () => {
        expect(CURATED_SNIPPETS_LIST.length).toBeGreaterThan(0);
    });

    it("all curated snippets have required fields", () => {
        for (const snippet of CURATED_SNIPPETS_LIST) {
            expect(snippet.id).toBeTruthy();
            expect(snippet.problemId).toBeTruthy();
            expect(snippet.title).toBeTruthy();
            expect(snippet.content.length).toBeGreaterThan(0);
            expect(["javascript", "python", "java", "cpp"]).toContain(snippet.language);
            expect(["short", "medium", "long"]).toContain(snippet.lengthCategory);
            expect(["easy", "medium", "hard"]).toContain(snippet.difficulty);
            expect(snippet.lines).toBeGreaterThan(0);
        }
    });

    it("curated snippet content ends with newline", () => {
        for (const snippet of CURATED_SNIPPETS_LIST) {
            expect(snippet.content.endsWith("\n")).toBe(true);
        }
    });

    it("curated snippet content has no \\r\\n", () => {
        for (const snippet of CURATED_SNIPPETS_LIST) {
            expect(snippet.content).not.toContain("\r\n");
        }
    });
});

describe("normalizeDataset", () => {
    it("returns empty array for non-array input", () => {
        expect(normalizeDataset(null)).toEqual([]);
        expect(normalizeDataset("string")).toEqual([]);
        expect(normalizeDataset(42)).toEqual([]);
        expect(normalizeDataset({})).toEqual([]);
    });

    it("returns empty array for empty array", () => {
        expect(normalizeDataset([])).toEqual([]);
    });

    it("skips entries with unsupported languages", () => {
        const result = normalizeDataset([
            { lang: "ruby", content: "puts 'hello'", title: "test" },
        ]);
        expect(result).toEqual([]);
    });

    it("skips entries with empty content", () => {
        const result = normalizeDataset([
            { lang: "javascript", content: "", title: "test" },
        ]);
        expect(result).toEqual([]);
    });

    it("skips skeletal javascript snippets", () => {
        const result = normalizeDataset([
            {
                lang: "javascript",
                content: "var twoSum = function(nums, target) {\n};",
                title: "Two Sum",
                id: "test-skel",
            },
        ]);
        expect(result).toEqual([]);
    });

    it("skips skeletal python snippets", () => {
        const result = normalizeDataset([
            {
                lang: "python",
                content: "class Solution:\n    def twoSum(self, nums, target):\n        pass",
                title: "Two Sum",
                id: "test-skel",
            },
        ]);
        expect(result).toEqual([]);
    });

    it("normalizes valid entries", () => {
        const result = normalizeDataset([
            {
                lang: "javascript",
                content: "function add(a, b) {\n    return a + b;\n}\n",
                title: "Add",
                id: "js-add",
                difficulty: "easy",
            },
        ]);
        expect(result).toHaveLength(1);
        expect(result[0].language).toBe("javascript");
        expect(result[0].title).toBe("Add");
        expect(result[0].difficulty).toBe("easy");
        expect(result[0].content.endsWith("\n")).toBe(true);
    });

    it("strips comments from content", () => {
        const result = normalizeDataset([
            {
                lang: "javascript",
                content: "// comment\nfunction add(a, b) {\n    return a + b;\n}\n",
                title: "Add",
                id: "js-add-comment",
            },
        ]);
        expect(result).toHaveLength(1);
        expect(result[0].content).not.toContain("// comment");
    });

    it("defaults difficulty to easy", () => {
        const result = normalizeDataset([
            {
                lang: "javascript",
                content: "function add(a, b) {\n    return a + b;\n}\n",
                title: "Add",
                id: "js-add-nodifficulty",
            },
        ]);
        expect(result[0].difficulty).toBe("easy");
    });
});

describe("buildProblemsFromSnippets", () => {
    const snippets: Snippet[] = [
        {
            id: "js-a-short",
            problemId: "javascript:a",
            title: "Problem A",
            content: "code\n",
            language: "javascript",
            lengthCategory: "short",
            difficulty: "easy",
            lines: 1,
        },
        {
            id: "js-a-medium",
            problemId: "javascript:a",
            title: "Problem A",
            content: "longer code\n",
            language: "javascript",
            lengthCategory: "medium",
            difficulty: "easy",
            lines: 15,
        },
        {
            id: "js-b-short",
            problemId: "javascript:b",
            title: "Problem B",
            content: "code b\n",
            language: "javascript",
            lengthCategory: "short",
            difficulty: "medium",
            lines: 1,
        },
    ];

    it("groups snippets into problems by problemId", () => {
        const problems = buildProblemsFromSnippets(snippets);
        expect(problems).toHaveLength(2);
    });

    it("collects available lengths for each problem", () => {
        const problems = buildProblemsFromSnippets(snippets);
        const problemA = problems.find((p) => p.id === "javascript:a");
        expect(problemA?.availableLengths).toEqual(["short", "medium"]);
    });

    it("sorts problems alphabetically by title", () => {
        const problems = buildProblemsFromSnippets(snippets);
        expect(problems[0].title).toBe("Problem A");
        expect(problems[1].title).toBe("Problem B");
    });
});

describe("getProblems", () => {
    it("filters by language", () => {
        const problems = getProblems(CURATED_SNIPPETS_LIST, "python");
        expect(problems.length).toBeGreaterThan(0);
        expect(problems.every((p) => p.language === "python")).toBe(true);
    });

    it("filters by length", () => {
        const problems = getProblems(CURATED_SNIPPETS_LIST, "javascript", { length: "short" });
        for (const p of problems) {
            expect(p.availableLengths).toContain("short");
        }
    });
});

describe("getProblemSnippets", () => {
    it("returns snippets for a specific problem", () => {
        const problems = getProblems(CURATED_SNIPPETS_LIST, "python");
        if (problems.length === 0) return;
        const snippets = getProblemSnippets(CURATED_SNIPPETS_LIST, "python", problems[0].id);
        expect(snippets.length).toBeGreaterThan(0);
        expect(snippets.every((s) => s.problemId === problems[0].id)).toBe(true);
    });

    it("respects length filter", () => {
        const snippets = getProblemSnippets(CURATED_SNIPPETS_LIST, "javascript", "javascript:js-array-helpers", { length: "short" });
        for (const s of snippets) {
            expect(s.lengthCategory).toBe("short");
        }
    });
});

describe("getSnippet", () => {
    it("returns a snippet for a language", () => {
        const snippet = getSnippet(CURATED_SNIPPETS_LIST, "python");
        expect(snippet).toBeDefined();
        expect(snippet.language).toBe("python");
    });

    it("prefers matching length filter", () => {
        const snippet = getSnippet(CURATED_SNIPPETS_LIST, "javascript", { length: "short" });
        expect(snippet.lengthCategory).toBe("short");
    });

    it("falls back to any snippet if length filter has no match", () => {
        const snippet = getSnippet(CURATED_SNIPPETS_LIST, "javascript");
        expect(snippet).toBeDefined();
    });
});

describe("stripComments (via normalizeDataset)", () => {
    function makeRawSnippet(content: string, lang: string) {
        return [{
            id: "test-strip",
            lang,
            difficulty: "easy",
            title: "Test",
            content,
            lines: content.split("\n").length,
            lengthCategory: "short",
            problemId: "test",
        }];
    }

    it("preserves URLs inside JavaScript strings", () => {
        const content = 'const url = "https://example.com";\nconst x = 1;\n';
        const result = normalizeDataset(makeRawSnippet(content, "javascript"));
        expect(result).toHaveLength(1);
        expect(result[0].content).toContain("https://example.com");
    });

    it("removes actual line comments in JavaScript", () => {
        const content = 'const x = 1; // comment\nconst y = 2;\n';
        const result = normalizeDataset(makeRawSnippet(content, "javascript"));
        expect(result).toHaveLength(1);
        expect(result[0].content).not.toContain("// comment");
        expect(result[0].content).toContain("const x = 1;");
    });

    it("preserves hash characters inside Python strings", () => {
        const content = 'color = "#ff0000"\nprint(color)\n';
        const result = normalizeDataset(makeRawSnippet(content, "python"));
        expect(result).toHaveLength(1);
        expect(result[0].content).toContain("#ff0000");
    });

    it("removes actual hash comments in Python", () => {
        const content = 'x = 1  # comment\ny = 2\n';
        const result = normalizeDataset(makeRawSnippet(content, "python"));
        expect(result).toHaveLength(1);
        expect(result[0].content).not.toContain("# comment");
    });

    it("preserves triple-quoted strings that are not docstrings", () => {
        const content = 'msg = """hello world"""\nprint(msg)\n';
        const result = normalizeDataset(makeRawSnippet(content, "python"));
        expect(result).toHaveLength(1);
        expect(result[0].content).toContain("hello world");
    });
});

describe("snippet variance helpers", () => {
    it("marks short pandas signatures as low variance", () => {
        const snippet: Snippet = {
            id: "python:pandas-one",
            problemId: "python:pandas-one",
            title: "Pandas One",
            content: "import pandas as pd\n\ndef foo(df: pd.DataFrame) -> pd.DataFrame:\n",
            language: "python",
            lengthCategory: "short",
            difficulty: "easy",
            lines: 3,
        };

        expect(getSnippetVarianceTag(snippet)).toBe("python-pandas-signature");
    });

    it("scores full snippets above low-variance stubs", () => {
        const full: Snippet = {
            id: "python:full",
            problemId: "python:full",
            title: "Full",
            content: "def total(values: list[int]) -> int:\n    return sum(values)\n",
            language: "python",
            lengthCategory: "short",
            difficulty: "easy",
            lines: 2,
        };
        const pandas: Snippet = {
            id: "python:pandas",
            problemId: "python:pandas",
            title: "Pandas",
            content: "import pandas as pd\n\ndef foo(df: pd.DataFrame) -> pd.DataFrame:\n",
            language: "python",
            lengthCategory: "short",
            difficulty: "easy",
            lines: 3,
        };

        expect(getSnippetVarietyScore(full)).toBeGreaterThan(getSnippetVarietyScore(pandas));
    });
});
