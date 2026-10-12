import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupportedLanguage } from "../snippets";

beforeEach(() => vi.resetModules());

const orders: SupportedLanguage[][] = [["javascript", "python"], ["python", "javascript"]];
describe.each(orders)("language cache order %s then %s", (first, second) => {
    it("keeps keyword categories and downstream caches independent", async () => {
        const { tokenize, buildCategoryMap } = await import("../tokenizer");
        const { computePatternScore, createPatternScoreCalculator } = await import("../scoring");
        const { analyzeWeakPatterns } = await import("../pattern-analysis");
        const content = "pass x";
        const errors = [{ index: 0, expected: "p", got: "q" }];
        const positions = [0];
        const results = [first, second].map((language) => {
            const tokens = tokenize(content, language);
            const category = language === "python" ? "keyword" : "identifier";
            expect(tokens[0].category).toBe(category);
            expect(buildCategoryMap(tokens, content.length)[0]).toBe(category);
            expect(analyzeWeakPatterns(errors, tokens, content.length, language)[0].category).toBe(category);
            const input = { tokens, contentLength: content.length, language };
            const calculator = createPatternScoreCalculator(input);
            const expectedScore = language === "python" ? 81 : 82;
            expect(calculator(positions)).toBe(expectedScore);
            expect(computePatternScore({ ...input, errorPositions: positions })).toBe(expectedScore);
            return { tokens, calculator };
        });
        expect(results[0].tokens).not.toBe(results[1].tokens);
        expect(results[0].calculator).not.toBe(results[1].calculator);
        expect(tokenize(content, first)).toBe(results[0].tokens);
        expect(tokenize(content, second)).toBe(results[1].tokens);
    });

    it.each(["# cache comment", '\"\"\"a\"b\"\"\"'])("preserves language-specific syntax for %s", async (content) => {
        const { tokenize } = await import("../tokenizer");
        const results = new Map([first, second].map((language) => [language, tokenize(content, language)]));
        const python = results.get("python")!;
        const javascript = results.get("javascript")!;
        expect(python).toHaveLength(1);
        expect(python[0]).toMatchObject({ category: content[0] === "#" ? "comment" : "string", text: content });
        expect(javascript.length).toBeGreaterThan(1);
        for (const tokens of results.values()) expect(tokens.map((token) => token.text).join("")).toBe(content);
    });
});

it("separates Java and C++ keyword sets while reusing each language", async () => {
    const { tokenize } = await import("../tokenizer");
    const java = tokenize("namespace", "java");
    const cpp = tokenize("namespace", "cpp");
    expect(java[0].category).toBe("identifier");
    expect(cpp[0].category).toBe("keyword");
    expect(tokenize("namespace", "java")).toBe(java);
    expect(tokenize("namespace", "cpp")).toBe(cpp);
});

it("classifies the original pass reproduction independently", async () => {
    const { tokenize } = await import("../tokenizer");
    expect(tokenize("pass", "javascript")[0].category).toBe("identifier");
    expect(tokenize("pass", "python")[0].category).toBe("keyword");
});
