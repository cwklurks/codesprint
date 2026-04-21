/**
 * Regex-based tokenizers for JS, Python, Java, and C++.
 *
 * Each tokenizer produces a flat Token[] that covers the entire snippet content
 * character-by-character. Tokens are non-overlapping and contiguous.
 */

import type { SupportedLanguage } from "./snippets";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TokenCategory =
    | "keyword"
    | "operator"
    | "delimiter"
    | "identifier"
    | "literal"
    | "whitespace"
    | "comment"
    | "string";

export type Token = {
    /** Category of this token */
    category: TokenCategory;
    /** Start index (inclusive) in the source string */
    start: number;
    /** End index (exclusive) in the source string */
    end: number;
    /** The raw text of this token */
    text: string;
};

/** Token array augmented with a numeric cache ID */
export interface CachedTokenArray extends Array<Token> {
    _id: number;
}

// ---------------------------------------------------------------------------
// Language keyword sets
// ---------------------------------------------------------------------------

const JS_KEYWORDS = new Set([
    "abstract", "arguments", "async", "await", "boolean", "break", "byte", "case", "catch",
    "char", "class", "const", "continue", "debugger", "default", "delete", "do", "double",
    "else", "enum", "export", "extends", "false", "final", "finally", "float", "for",
    "function", "goto", "if", "implements", "import", "in", "instanceof", "int", "interface",
    "let", "long", "native", "new", "null", "of", "package", "private", "protected", "public",
    "return", "short", "static", "super", "switch", "synchronized", "this", "throw", "throws",
    "transient", "true", "try", "typeof", "undefined", "var", "void", "volatile", "while",
    "with", "yield",
]);

const PYTHON_KEYWORDS = new Set([
    "False", "None", "True", "and", "as", "assert", "async", "await", "break", "class",
    "continue", "def", "del", "elif", "else", "except", "finally", "for", "from", "global",
    "if", "import", "in", "is", "lambda", "nonlocal", "not", "or", "pass", "raise", "return",
    "try", "while", "with", "yield",
]);

const JAVA_KEYWORDS = new Set([
    "abstract", "assert", "boolean", "break", "byte", "case", "catch", "char", "class",
    "const", "continue", "default", "do", "double", "else", "enum", "extends", "false",
    "final", "finally", "float", "for", "goto", "if", "implements", "import", "instanceof",
    "int", "interface", "long", "native", "new", "null", "package", "private", "protected",
    "public", "return", "short", "static", "strictfp", "super", "switch", "synchronized",
    "this", "throw", "throws", "transient", "true", "try", "void", "volatile", "while",
]);

const CPP_KEYWORDS = new Set([
    "alignas", "alignof", "and", "and_eq", "asm", "auto", "bitand", "bitor", "bool", "break",
    "case", "catch", "char", "char8_t", "char16_t", "char32_t", "class", "compl", "concept",
    "const", "consteval", "constexpr", "constinit", "const_cast", "continue", "co_await",
    "co_return", "co_yield", "decltype", "default", "delete", "do", "double", "dynamic_cast",
    "else", "enum", "explicit", "export", "extern", "false", "float", "for", "friend", "goto",
    "if", "inline", "int", "long", "mutable", "namespace", "new", "noexcept", "not", "not_eq",
    "nullptr", "operator", "or", "or_eq", "private", "protected", "public", "register",
    "reinterpret_cast", "requires", "return", "short", "signed", "sizeof", "static",
    "static_assert", "static_cast", "struct", "switch", "template", "this", "thread_local",
    "throw", "true", "try", "typedef", "typeid", "typename", "union", "unsigned", "using",
    "virtual", "void", "volatile", "wchar_t", "while", "xor", "xor_eq",
    // common types used as keywords in practice
    "std", "string", "vector", "map", "set", "size_t", "uint8_t", "int32_t",
]);

const KEYWORD_SETS: Record<SupportedLanguage, Set<string>> = {
    javascript: JS_KEYWORDS,
    python: PYTHON_KEYWORDS,
    java: JAVA_KEYWORDS,
    cpp: CPP_KEYWORDS,
};

// ---------------------------------------------------------------------------
// Fast character classification via lookup tables
// ---------------------------------------------------------------------------

// Character type constants for dispatch
const CT_OTHER = 0;
const CT_WS = 1;
const CT_QUOTE = 2;
const CT_DIGIT = 3;
const CT_IDENT = 4;
const CT_DELIM = 5;
const CT_OP = 6;
const CT_SLASH = 7;
const CT_HASH = 8;

// Primary dispatch table: maps charCode → character type
const CHAR_TYPE = new Uint8Array(128);
for (let c = 0; c < 128; c++) {
    if (c === 32 || c === 9 || c === 10 || c === 13) CHAR_TYPE[c] = CT_WS;
    else if (c === 34 || c === 39 || c === 96) CHAR_TYPE[c] = CT_QUOTE;
    else if (c >= 48 && c <= 57) CHAR_TYPE[c] = CT_DIGIT;
    else if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95 || c === 36) CHAR_TYPE[c] = CT_IDENT;
    else if (c === 47) CHAR_TYPE[c] = CT_SLASH;
    else if (c === 35) CHAR_TYPE[c] = CT_HASH;
}
// Delimiters
for (const ch of ["(", ")", "[", "]", "{", "}", ",", ";", ":", "."]) {
    CHAR_TYPE[ch.charCodeAt(0)] = CT_DELIM;
}
// Operators (excluding slash which has its own type)
for (const ch of ["+", "-", "*", "%", "=", "<", ">", "!", "&", "|", "^", "~", "?", "@"]) {
    CHAR_TYPE[ch.charCodeAt(0)] = CT_OP;
}

// Operator continuation table (includes slash for multi-char operators like /=)
const IS_OPERATOR = new Uint8Array(128);
for (const ch of ["+", "-", "*", "/", "%", "=", "<", ">", "!", "&", "|", "^", "~", "?", "@"]) {
    IS_OPERATOR[ch.charCodeAt(0)] = 1;
}

// Identifier continuation lookup
const IS_IDENT_CHAR = new Uint8Array(128);
for (let c = 0; c < 128; c++) {
    if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57) || c === 95 || c === 36) {
        IS_IDENT_CHAR[c] = 1;
    }
}

// Numeric continuation lookup
const IS_NUMERIC_CHAR = new Uint8Array(128);
for (let c = 0; c < 128; c++) {
    if ((c >= 48 && c <= 57) // 0-9
        || (c >= 65 && c <= 70) // A-F
        || (c >= 97 && c <= 102) // a-f
        || c === 120 || c === 88 // x, X
        || c === 111 || c === 79 // o, O
        || c === 98 || c === 66 // b, B
        || c === 46 // .
        || c === 95 // _
        || c === 101 || c === 69 // e, E
        || c === 43 || c === 45 // +, -
    ) {
        IS_NUMERIC_CHAR[c] = 1;
    }
}

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

/**
 * Tokenize a snippet's content into a flat Token[] covering every character.
 *
 * The tokenizer is intentionally simple (regex + character scanning) rather than
 * a full parser. It's accurate enough for scoring weights and pattern analysis.
 */
// Memoization cache: plain object for faster string-key lookup
const _tokenizeCache: Record<string, Token[]> = Object.create(null);
let _nextTokenId = 0;

// Global array caches indexed by token ID — avoids named property access on token arrays
export const _cmCache: (TokenCategory[] | null)[] = [];
export const _pscCache: ([number[], number] | null)[] = [];
export const _calcCache: (((ep: number[]) => number) | null)[] = [];
export const _wpCache: ([unknown[], unknown[]] | null)[] = [];

export function tokenize(content: string, language: SupportedLanguage): Token[] {
    return _tokenizeCache[content] || _tokenizeImpl(content, language);
}

function _tokenizeImpl(content: string, language: SupportedLanguage): Token[] {
    const keywords = KEYWORD_SETS[language];
    const tokens: Token[] = [];
    // Assign numeric ID for fast global array-indexed caching
    (tokens as CachedTokenArray)._id = _nextTokenId++;
    const len = content.length;
    let i = 0;

    while (i < len) {
        const cc = content.charCodeAt(i);

        switch (cc < 128 ? CHAR_TYPE[cc] : CT_OTHER) {
            case CT_WS: {
                const start = i;
                i++;
                while (i < len) { const c = content.charCodeAt(i); if (c !== 32 && c !== 9 && c !== 10 && c !== 13) break; i++; }
                tokens.push({ category: "whitespace", start, end: i, text: content.slice(start, i) });
                break;
            }
            case CT_IDENT: {
                const start = i;
                i++;
                while (i < len) { const c = content.charCodeAt(i); if (c >= 128 || !IS_IDENT_CHAR[c]) break; i++; }
                const text = content.slice(start, i);
                tokens.push({ category: keywords.has(text) ? "keyword" : "identifier", start, end: i, text });
                break;
            }
            case CT_DELIM: {
                tokens.push({ category: "delimiter", start: i, end: i + 1, text: content[i] });
                i++;
                break;
            }
            case CT_OP: {
                const start = i;
                i++;
                while (i < len) { const c = content.charCodeAt(i); if (c >= 128 || !IS_OPERATOR[c]) break; i++; }
                tokens.push({ category: "operator", start, end: i, text: content.slice(start, i) });
                break;
            }
            case CT_DIGIT: {
                const start = i;
                i++;
                while (i < len) { const c = content.charCodeAt(i); if (c >= 128 || !IS_NUMERIC_CHAR[c]) break; i++; }
                tokens.push({ category: "literal", start, end: i, text: content.slice(start, i) });
                break;
            }
            case CT_QUOTE: {
                const start = i;
                const quote = cc;
                if (language === "python" && i + 2 < len && content.charCodeAt(i + 1) === quote && content.charCodeAt(i + 2) === quote) {
                    i += 3;
                    while (i + 2 < len && !(content.charCodeAt(i) === quote && content.charCodeAt(i + 1) === quote && content.charCodeAt(i + 2) === quote)) i++;
                    i = Math.min(i + 3, len);
                } else {
                    i++;
                    while (i < len && content.charCodeAt(i) !== quote) {
                        if (content.charCodeAt(i) === 92) i++;
                        i++;
                    }
                    if (i < len) i++;
                }
                tokens.push({ category: "string", start, end: i, text: content.slice(start, i) });
                break;
            }
            case CT_SLASH: {
                if (i + 1 < len) {
                    const next = content.charCodeAt(i + 1);
                    if (next === 47) {
                        const start = i;
                        while (i < len && content.charCodeAt(i) !== 10) i++;
                        tokens.push({ category: "comment", start, end: i, text: content.slice(start, i) });
                        break;
                    }
                    if (next === 42) {
                        const start = i;
                        i += 2;
                        while (i + 1 < len && !(content.charCodeAt(i) === 42 && content.charCodeAt(i + 1) === 47)) i++;
                        i = Math.min(i + 2, len);
                        tokens.push({ category: "comment", start, end: i, text: content.slice(start, i) });
                        break;
                    }
                }
                // Not a comment — treat as operator
                const start = i;
                i++;
                while (i < len) { const c = content.charCodeAt(i); if (c >= 128 || !IS_OPERATOR[c]) break; i++; }
                tokens.push({ category: "operator", start, end: i, text: content.slice(start, i) });
                break;
            }
            case CT_HASH: {
                if (language === "python") {
                    const start = i;
                    while (i < len && content.charCodeAt(i) !== 10) i++;
                    tokens.push({ category: "comment", start, end: i, text: content.slice(start, i) });
                    break;
                }
                tokens.push({ category: "identifier", start: i, end: i + 1, text: content[i] });
                i++;
                break;
            }
            default: {
                tokens.push({ category: "identifier", start: i, end: i + 1, text: content[i] });
                i++;
                break;
            }
        }
    }

    _tokenizeCache[content] = tokens;
    return tokens;
}

/**
 * Build a lookup array mapping each character index to its token category.
 * This enables O(1) lookups during scoring.
 */
export function buildCategoryMap(tokens: Token[], length: number): TokenCategory[] {
    const id = (tokens as CachedTokenArray)._id;
    return _cmCache[id] || _buildCategoryMapCold(tokens, length, id);
}

function _buildCategoryMapCold(tokens: Token[], length: number, id: number): TokenCategory[] {
    const map: TokenCategory[] = new Array(length);
    for (let t = 0; t < tokens.length; t++) {
        const tok = tokens[t];
        const cat = tok.category;
        const end = Math.min(tok.end, length);
        for (let i = tok.start; i < end; i++) {
            map[i] = cat;
        }
    }
    _cmCache[id] = map;
    return map;
}
