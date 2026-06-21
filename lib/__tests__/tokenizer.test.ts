import { describe, it, expect } from "vitest";
import { tokenize, buildCategoryMap, __testTokenizeCacheSize, _cmCache } from "../tokenizer";
import type { TokenCategory } from "../tokenizer";

describe("tokenize", () => {
    describe("JavaScript", () => {
        it("tokenizes keywords", () => {
            const tokens = tokenize("const x = 1;", "javascript");
            expect(tokens[0]).toMatchObject({ category: "keyword", text: "const" });
        });

        it("tokenizes identifiers", () => {
            const tokens = tokenize("const myVar = 1;", "javascript");
            const ident = tokens.find((t) => t.text === "myVar");
            expect(ident).toBeDefined();
            expect(ident!.category).toBe("identifier");
        });

        it("tokenizes operators", () => {
            const tokens = tokenize("a === b", "javascript");
            const op = tokens.find((t) => t.text === "===");
            expect(op).toBeDefined();
            expect(op!.category).toBe("operator");
        });

        it("tokenizes delimiters", () => {
            const tokens = tokenize("foo(a, b)", "javascript");
            const parens = tokens.filter((t) => t.category === "delimiter");
            expect(parens.length).toBeGreaterThanOrEqual(3); // (, ,, )
        });

        it("tokenizes string literals", () => {
            const tokens = tokenize('"hello world"', "javascript");
            const str = tokens.find((t) => t.category === "string");
            expect(str).toBeDefined();
            expect(str!.text).toBe('"hello world"');
        });

        it("tokenizes template literals", () => {
            const tokens = tokenize("`hello ${name}`", "javascript");
            const str = tokens.find((t) => t.category === "string");
            expect(str).toBeDefined();
        });

        it("tokenizes line comments", () => {
            const tokens = tokenize("x = 1 // comment\ny = 2", "javascript");
            const comment = tokens.find((t) => t.category === "comment");
            expect(comment).toBeDefined();
            expect(comment!.text).toBe("// comment");
        });

        it("tokenizes block comments", () => {
            const tokens = tokenize("/* block */ x", "javascript");
            const comment = tokens.find((t) => t.category === "comment");
            expect(comment).toBeDefined();
            expect(comment!.text).toBe("/* block */");
        });

        it("tokenizes numeric literals", () => {
            const tokens = tokenize("const x = 42;", "javascript");
            const num = tokens.find((t) => t.category === "literal");
            expect(num).toBeDefined();
            expect(num!.text).toBe("42");
        });

        it("covers entire content without gaps", () => {
            const content = 'function add(a, b) {\n    return a + b;\n}\n';
            const tokens = tokenize(content, "javascript");
            let covered = 0;
            for (const t of tokens) {
                expect(t.end).toBeGreaterThan(t.start);
                covered += t.end - t.start;
            }
            expect(covered).toBe(content.length);
        });
    });

    describe("Python", () => {
        it("tokenizes Python keywords", () => {
            const tokens = tokenize("def foo():\n    return None", "python");
            expect(tokens[0]).toMatchObject({ category: "keyword", text: "def" });
            const ret = tokens.find((t) => t.text === "return");
            expect(ret?.category).toBe("keyword");
        });

        it("tokenizes hash comments", () => {
            const tokens = tokenize("x = 1 # comment\ny = 2", "python");
            const comment = tokens.find((t) => t.category === "comment");
            expect(comment).toBeDefined();
            expect(comment!.text).toBe("# comment");
        });

        it("tokenizes triple-quoted strings", () => {
            const tokens = tokenize('"""docstring"""', "python");
            const str = tokens.find((t) => t.category === "string");
            expect(str).toBeDefined();
            expect(str!.text).toBe('"""docstring"""');
        });

        it("tokenizes decorators as operators", () => {
            const tokens = tokenize("@decorator\ndef foo(): pass", "python");
            const at = tokens.find((t) => t.text === "@");
            expect(at).toBeDefined();
            expect(at!.category).toBe("operator");
        });
    });

    describe("Java", () => {
        it("tokenizes Java keywords", () => {
            const tokens = tokenize("public class Foo {}", "java");
            expect(tokens[0]).toMatchObject({ category: "keyword", text: "public" });
            const cls = tokens.find((t) => t.text === "class");
            expect(cls?.category).toBe("keyword");
        });

        it("tokenizes annotations as operators", () => {
            const tokens = tokenize("@Override\npublic void foo() {}", "java");
            const at = tokens.find((t) => t.text === "@");
            expect(at?.category).toBe("operator");
        });
    });

    describe("C++", () => {
        it("tokenizes C++ keywords", () => {
            const tokens = tokenize("template <typename T>", "cpp");
            expect(tokens[0]).toMatchObject({ category: "keyword", text: "template" });
            const tn = tokens.find((t) => t.text === "typename");
            expect(tn?.category).toBe("keyword");
        });

        it("tokenizes std as keyword", () => {
            const tokens = tokenize("std::vector<int> v;", "cpp");
            const std = tokens.find((t) => t.text === "std");
            expect(std?.category).toBe("keyword");
        });

        it("handles scope operator", () => {
            const tokens = tokenize("std::cout", "cpp");
            const colons = tokens.filter((t) => t.category === "delimiter" && t.text === ":");
            expect(colons.length).toBe(2);
        });
    });
});

describe("buildCategoryMap", () => {
    it("maps each character to its token category", () => {
        const content = "if (x) {}";
        const tokens = tokenize(content, "javascript");
        const map = buildCategoryMap(tokens, content.length);

        expect(map.length).toBe(content.length);
        // "if" should be keyword
        expect(map[0]).toBe("keyword");
        expect(map[1]).toBe("keyword");
        // space
        expect(map[2]).toBe("whitespace");
        // "("
        expect(map[3]).toBe("delimiter");
    });
});

describe("tokenizer cache", () => {
    it("isolates cache entries by language (python then javascript)", () => {
        const pythonTokens = tokenize("def foo(): pass", "python");
        expect(pythonTokens[0]).toMatchObject({ category: "keyword", text: "def" });

        const jsTokens = tokenize("def foo(): pass", "javascript");
        expect(jsTokens[0]).toMatchObject({ category: "identifier", text: "def" });
    });

    it("isolates cache entries by language (javascript then python)", () => {
        const jsTokens = tokenize("const x = 1;", "javascript");
        expect(jsTokens[0]).toMatchObject({ category: "keyword", text: "const" });

        const pythonTokens = tokenize("const x = 1;", "python");
        expect(pythonTokens[0]).toMatchObject({ category: "identifier", text: "const" });
    });

    it("caps the tokenize cache at 256 entries (LRU)", () => {
        for (let i = 0; i < 300; i++) {
            tokenize(`const x${i} = ${i};`, "javascript");
        }
        expect(__testTokenizeCacheSize()).toBeLessThanOrEqual(256);
    });

    it("caps the category map cache at 128 entries (LRU)", () => {
        for (let i = 0; i < 200; i++) {
            const tokens = tokenize(`const x${i} = ${i};`, "javascript");
            buildCategoryMap(tokens, tokens.length);
        }
        expect((_cmCache as unknown as Map<number, TokenCategory[]>).size).toBeLessThanOrEqual(128);
    });
});
