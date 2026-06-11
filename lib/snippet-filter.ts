/**
 * Shared "is this snippet just an empty stub?" filter.
 *
 * LeetCode starter code is overwhelmingly signature-only scaffolding (a class
 * declaration, a method signature, and an empty body). Typing an empty shell
 * teaches nothing, so both the build-time preprocessor (scripts/build-snippets.ts)
 * and the runtime normalizer (lib/snippets.ts) drop skeletal snippets.
 *
 * This module is the single source of truth for that decision so the two call
 * sites cannot drift apart (they previously did: only JS/Python were handled and
 * Java/C++ fell through to `return false`, so ~99% of the Java/C++ corpus shipped
 * as empty stubs).
 */

export type SkeletalLanguage = "javascript" | "python" | "java" | "cpp";

// Control-flow keywords whose presence on a line means real logic is happening.
const CONTROL_KEYWORDS = /\b(if|else|for|while|switch|do|try|catch|finally|synchronized)\b/;
// Statement keywords that indicate an executed statement (not a declaration).
const STATEMENT_KEYWORDS = /\b(return|throw|break|continue|yield|await|delete|goto|co_return|co_await|co_yield)\b/;
// A call expression, e.g. `foo()` or `obj.bar(x)`.
const CALL_PATTERN = /\w\s*\([^)]*\)/;

// Lines that are pure structure and never count as a real body.
const LONE_PUNCTUATION = /^[{}()\[\];,]+$/;
const ACCESS_SPECIFIER = /^(public|private|protected)\s*:$/; // C++ access labels
const BOILERPLATE_LINE = /^(#|import\b|package\b|using\b|namespace\b|template\b|class\b|struct\b|interface\b|enum\b|@)/;
const TYPED_CLASS_DECL = /^(public|private|protected|final|abstract|static|sealed)\s+(class|interface|enum|struct)\b/;

/**
 * Brace-based languages (JS/Java/C++): a snippet is skeletal when it contains no
 * line that is an actual statement or a control-flow body. Declarations, method
 * signatures, access specifiers, braces, fields, and (multi-line) parameter lists
 * do not count; `return value;`, calls, assignments, and `if (...) {` do.
 */
function isSkeletalBraced(lines: string[]): boolean {
    let substantiveLines = 0;
    let inSignatureParams = false;

    for (const line of lines) {
        // Inside a multi-line parameter list: skip until the params close.
        if (inSignatureParams) {
            if (line.includes(")")) inSignatureParams = false;
            continue;
        }

        if (LONE_PUNCTUATION.test(line)) continue;
        if (ACCESS_SPECIFIER.test(line)) continue;
        if (BOILERPLATE_LINE.test(line)) continue;
        if (TYPED_CLASS_DECL.test(line)) continue;

        const endsWithBrace = /\{$/.test(line);
        const endsWithSemicolon = /;$/.test(line);
        const opensUnbalancedParen =
            (line.split("(").length - 1) > (line.split(")").length - 1);

        if (endsWithBrace) {
            // A control-flow body opener is real logic; a method/closure/object
            // opener (`foo() {`, `return function() {`, `return {`) is scaffolding.
            if (CONTROL_KEYWORDS.test(line)) substantiveLines++;
            continue;
        }

        if (opensUnbalancedParen && !endsWithSemicolon) {
            // Start of a multi-line method signature / parameter list.
            inSignatureParams = true;
            continue;
        }

        // A statement-ish line: count it only if it carries real logic.
        if (
            CONTROL_KEYWORDS.test(line) ||
            STATEMENT_KEYWORDS.test(line) ||
            line.includes("=") ||
            CALL_PATTERN.test(line)
        ) {
            substantiveLines++;
        }
        // Otherwise it's a bare field/member declaration (`private int n;`) or
        // a stray token: not substantive.
    }

    return substantiveLines < 1;
}

/**
 * Python: indentation/colon based, so `def`, `class`, decorators, `pass`,
 * import lines, and a bare `...` ellipsis body are all scaffolding. A pandas
 * stub (`import pandas as pd` + a signature with no body) must read as skeletal.
 */
function isSkeletalPython(lines: string[]): boolean {
    let substantiveLines = 0;
    for (const line of lines) {
        if (
            !line.match(/^def .*:$/) &&
            !line.match(/^class /) &&
            !line.match(/^@/) &&
            !line.match(/^pass$/) &&
            !line.match(/^(import|from)\b/) &&
            !line.match(/^\.\.\.$/)
        ) {
            substantiveLines++;
        }
    }
    return substantiveLines < 1;
}

export function isSkeletal(content: string, language: string): boolean {
    const lines = content
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

    if (language === "python") return isSkeletalPython(lines);
    if (language === "javascript" || language === "java" || language === "cpp") {
        return isSkeletalBraced(lines);
    }
    // Unknown language: keep it rather than silently dropping content.
    return false;
}
