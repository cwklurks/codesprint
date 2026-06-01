/**
 * Pure helpers for turning source files from real code repos (e.g. TheAlgorithms,
 * MIT-licensed) into typing-practice snippets.
 *
 * All I/O (downloading repos, walking the filesystem) lives in
 * scripts/sync-algorithms.ts. This module is the testable core: given a file's
 * path and contents, decide whether it makes a good snippet and clean it up.
 */

import { isSkeletal } from "./snippet-filter";

export type SourceLanguage = "javascript" | "python" | "java" | "cpp";

export const SOURCE_EXTENSIONS: Record<SourceLanguage, string[]> = {
    javascript: [".js"],
    python: [".py"],
    java: [".java"],
    cpp: [".cpp", ".cc", ".cxx"],
};

// A good typing snippet is a self-contained chunk: long enough to be worth a run,
// short enough to finish in a sitting. Measured in non-blank lines after the
// license/doc header is stripped.
export const MIN_SNIPPET_LINES = 6;
export const MAX_SNIPPET_LINES = 40;

const EXCLUDED_PATH_FRAGMENTS = [
    "/test",
    "/tests",
    "test/",
    "tests/",
    "__pycache__",
    "/.github/",
    "/node_modules/",
    "/examples/",
    "/benchmark",
];

const EXCLUDED_FILENAME_PATTERNS = [
    /\.test\./i,
    /\.spec\./i,
    /test/i,
    /^index\.[jt]s$/i,
    /^__init__\.py$/i,
    /^mod\./i,
    /^main\./i,
];

/** Skip non-source files, test directories, and entry-point/index files. */
export function isExcludedPath(path: string): boolean {
    const lower = path.toLowerCase();
    if (EXCLUDED_PATH_FRAGMENTS.some((frag) => lower.includes(frag))) return true;
    const filename = path.split("/").pop() ?? path;
    return EXCLUDED_FILENAME_PATTERNS.some((re) => re.test(filename));
}

/** True when a file is really a test harness or a demo entry point, not a reusable snippet. */
export function hasMainOrTest(content: string, language: SourceLanguage): boolean {
    switch (language) {
        case "python":
            return (
                /\bif\s+__name__\s*==\s*['"]__main__['"]/.test(content) ||
                /\bimport\s+unittest\b/.test(content) ||
                /\bimport\s+doctest\b/.test(content) ||
                /\bdef\s+test_/.test(content)
            );
        case "javascript":
            return (
                /\b(describe|it|test)\s*\(/.test(content) ||
                /\brequire\(['"]assert['"]\)/.test(content) ||
                /\bexpect\s*\(/.test(content)
            );
        case "java":
            return (
                /public\s+static\s+void\s+main\b/.test(content) ||
                /@Test\b/.test(content) ||
                /\bimport\s+org\.junit/.test(content)
            );
        case "cpp":
            return /\bint\s+main\s*\(/.test(content) || /\bTEST\s*\(/.test(content);
    }
}

/**
 * Remove a trailing demo/test driver so the algorithm above it survives.
 * TheAlgorithms files routinely append a `main()` (C++) or `if __name__` block
 * (Python) that drives the function; that block is not worth typing and would
 * otherwise disqualify the whole file. Java mains live inside the class, so
 * cutting them would unbalance braces — leave Java to the file-level filter.
 */
export function stripTrailingDemo(content: string, language: SourceLanguage): string {
    const lines = content.split("\n");
    let cut = lines.length;
    if (language === "python") {
        const idx = lines.findIndex((l) => /^if\s+__name__\s*==\s*['"]__main__['"]\s*:/.test(l.trim()));
        if (idx !== -1) cut = idx;
    } else if (language === "cpp") {
        const idx = lines.findIndex((l) => /^\s*int\s+main\s*\(/.test(l));
        if (idx !== -1) cut = idx;
    }
    return lines.slice(0, cut).join("\n").trimEnd();
}

/** Remove a leading license/doc comment header so the snippet starts at real code. */
export function stripHeaderComment(content: string, language: SourceLanguage): string {
    let text = content.replace(/^﻿/, "");

    if (language === "python") {
        const lines = text.split("\n");
        let i = 0;
        // shebang + leading blank/# comment lines
        while (i < lines.length && (lines[i].trim() === "" || lines[i].trimStart().startsWith("#"))) i++;
        // a leading module docstring
        const rest = lines.slice(i);
        const firstCode = rest[0]?.trimStart() ?? "";
        if (firstCode.startsWith('"""') || firstCode.startsWith("'''")) {
            const quote = firstCode.slice(0, 3);
            const joined = rest.join("\n");
            const end = joined.indexOf(quote, 3);
            if (end !== -1) {
                return joined.slice(end + 3).replace(/^\s*\n/, "").trimEnd();
            }
        }
        return rest.join("\n").trimEnd();
    }

    // C-like: strip a leading /* ... */ block, then leading // comment / blank lines.
    text = text.trimStart();
    if (text.startsWith("/*")) {
        const end = text.indexOf("*/");
        if (end !== -1) text = text.slice(end + 2);
    }
    const lines = text.split("\n");
    let i = 0;
    while (i < lines.length && (lines[i].trim() === "" || lines[i].trimStart().startsWith("//"))) i++;
    return lines.slice(i).join("\n").trimEnd();
}

/** Count non-blank lines (a rough proxy for "how much is there to type"). */
export function countCodeLines(content: string): number {
    return content.split("\n").filter((l) => l.trim().length > 0).length;
}

/**
 * Turn a repo-relative path into a human title:
 *   "ciphers/caesar_cipher.py" -> "Caesar Cipher"
 *   "sorts/binarySearch.js"    -> "Binary Search"
 */
export function titleFromPath(path: string): string {
    const base = (path.split("/").pop() ?? path).replace(/\.[^.]+$/, "");
    return base
        .replace(/[_-]+/g, " ")
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/\s+/g, " ")
        .trim()
        .split(" ")
        .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
        .join(" ");
}

/** Final gate: a header-stripped file is usable if it's real code in the length window. */
export function isUsableSnippet(strippedContent: string, language: SourceLanguage): boolean {
    if (hasMainOrTest(strippedContent, language)) return false;
    const codeLines = countCodeLines(strippedContent);
    if (codeLines < MIN_SNIPPET_LINES || codeLines > MAX_SNIPPET_LINES) return false;
    if (isSkeletal(strippedContent, language)) return false;
    return true;
}
