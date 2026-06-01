import { describe, it, expect } from "vitest";
import {
    isExcludedPath,
    hasMainOrTest,
    stripHeaderComment,
    stripTrailingDemo,
    countCodeLines,
    titleFromPath,
    isUsableSnippet,
} from "../snippet-source";

describe("isExcludedPath", () => {
    it("excludes test directories and files", () => {
        expect(isExcludedPath("sorts/test/quick_sort_test.py")).toBe(true);
        expect(isExcludedPath("maths/quick_sort.test.js")).toBe(true);
        expect(isExcludedPath("Sorts/BubbleSortTest.java")).toBe(true);
    });
    it("excludes index / init / main entry files", () => {
        expect(isExcludedPath("src/index.js")).toBe(true);
        expect(isExcludedPath("ciphers/__init__.py")).toBe(true);
    });
    it("keeps a normal algorithm file", () => {
        expect(isExcludedPath("ciphers/caesar_cipher.py")).toBe(false);
        expect(isExcludedPath("sorts/bubble_sort.cpp")).toBe(false);
    });
});

describe("hasMainOrTest", () => {
    it("flags python __main__ / unittest / doctest", () => {
        expect(hasMainOrTest('if __name__ == "__main__":\n    run()', "python")).toBe(true);
        expect(hasMainOrTest("import unittest\n", "python")).toBe(true);
    });
    it("flags java main / @Test", () => {
        expect(hasMainOrTest("public static void main(String[] args) {}", "java")).toBe(true);
        expect(hasMainOrTest("@Test\npublic void t() {}", "java")).toBe(true);
    });
    it("flags cpp main", () => {
        expect(hasMainOrTest("int main() { return 0; }", "cpp")).toBe(true);
    });
    it("flags js test harnesses", () => {
        expect(hasMainOrTest("describe('x', () => {})", "javascript")).toBe(true);
    });
    it("does not flag a plain function", () => {
        expect(hasMainOrTest("def add(a, b):\n    return a + b", "python")).toBe(false);
        expect(hasMainOrTest("function add(a, b) { return a + b; }", "javascript")).toBe(false);
    });
});

describe("stripHeaderComment", () => {
    it("strips a leading C-style block license header", () => {
        const content = "/*\n * MIT License\n * Copyright x\n */\nfunction add(a, b) {\n  return a + b;\n}\n";
        expect(stripHeaderComment(content, "javascript")).toBe("function add(a, b) {\n  return a + b;\n}");
    });
    it("strips leading // comment lines", () => {
        const content = "// Bubble sort\n// O(n^2)\nvoid sort(int* a) {\n}\n";
        expect(stripHeaderComment(content, "cpp")).toBe("void sort(int* a) {\n}");
    });
    it("strips a python module docstring header", () => {
        const content = '"""\nCaesar cipher implementation.\n"""\ndef encrypt(text):\n    return text\n';
        expect(stripHeaderComment(content, "python")).toBe("def encrypt(text):\n    return text");
    });
    it("strips leading python # comments", () => {
        const content = "#!/usr/bin/env python3\n# helper\ndef f(x):\n    return x\n";
        expect(stripHeaderComment(content, "python")).toBe("def f(x):\n    return x");
    });
    it("leaves a clean file unchanged (modulo trailing whitespace)", () => {
        const content = "def f(x):\n    return x * 2\n";
        expect(stripHeaderComment(content, "python")).toBe("def f(x):\n    return x * 2");
    });
});

describe("stripTrailingDemo", () => {
    it("cuts a python __main__ block, keeping the function above", () => {
        const content = "def add(a, b):\n    return a + b\n\n\nif __name__ == \"__main__\":\n    print(add(1, 2))";
        expect(stripTrailingDemo(content, "python")).toBe("def add(a, b):\n    return a + b");
    });
    it("cuts a cpp main(), keeping the function above", () => {
        const content = "int add(int a, int b) {\n    return a + b;\n}\n\nint main() {\n    return 0;\n}";
        expect(stripTrailingDemo(content, "cpp")).toBe("int add(int a, int b) {\n    return a + b;\n}");
    });
    it("leaves content without a demo block unchanged", () => {
        const content = "def f(x):\n    return x";
        expect(stripTrailingDemo(content, "python")).toBe(content);
    });
    it("does not cut Java (mains live inside the class)", () => {
        const content = "class A {\n    public static void main(String[] a) {}\n}";
        expect(stripTrailingDemo(content, "java")).toBe(content);
    });
});

describe("countCodeLines", () => {
    it("counts non-blank lines", () => {
        expect(countCodeLines("a\n\nb\n  \nc")).toBe(3);
    });
});

describe("titleFromPath", () => {
    it("humanizes snake_case", () => {
        expect(titleFromPath("ciphers/caesar_cipher.py")).toBe("Caesar Cipher");
    });
    it("humanizes camelCase", () => {
        expect(titleFromPath("sorts/binarySearch.js")).toBe("Binary Search");
    });
    it("humanizes PascalCase", () => {
        expect(titleFromPath("Sorts/BubbleSort.java")).toBe("Bubble Sort");
    });
});

describe("isUsableSnippet", () => {
    const goodPy = "def gcd(a, b):\n    while b:\n        a, b = b, a % b\n    return a\n\ndef lcm(a, b):\n    return a * b // gcd(a, b)";
    it("accepts a real function in the length window", () => {
        expect(isUsableSnippet(goodPy, "python")).toBe(true);
    });
    it("rejects a too-short file", () => {
        expect(isUsableSnippet("x = 1", "python")).toBe(false);
    });
    it("rejects a too-long file", () => {
        const long = Array.from({ length: 50 }, (_, i) => `x${i} = ${i}`).join("\n");
        expect(isUsableSnippet(long, "python")).toBe(false);
    });
    it("rejects a main/test file even if the right length", () => {
        const withMain = "def add(a, b):\n    return a + b\n\n\nif __name__ == \"__main__\":\n    print(add(1, 2))\n    print(add(3, 4))";
        expect(isUsableSnippet(withMain, "python")).toBe(false);
    });
    it("rejects an empty stub", () => {
        const stub = "class Solution {\n    public int add(int a, int b) {\n        \n    }\n    public int sub(int a, int b) {\n        \n    }\n}";
        expect(isUsableSnippet(stub, "java")).toBe(false);
    });
});
