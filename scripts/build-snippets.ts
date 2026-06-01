#!/usr/bin/env bun

/**
 * Pre-processes the raw LeetCode snippets at build time.
 * This runs the expensive normalizeDataset() once instead of on every page load.
 * 
 * Outputs:
 * - snippets-{language}.json for each language (for fast per-language loading)
 * - snippets-processed.json with all snippets (legacy fallback)
 * 
 * Run with: bun scripts/build-snippets.ts
 */

import { writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { isSkeletal } from "../lib/snippet-filter";

type SupportedLanguage = "javascript" | "python" | "java" | "cpp";
type SnippetLength = "short" | "medium" | "long";
type Difficulty = "easy" | "medium" | "hard";

type TokenCategory =
    | "keyword"
    | "operator"
    | "delimiter"
    | "identifier"
    | "literal"
    | "whitespace"
    | "comment"
    | "string";

type Token = {
    category: TokenCategory;
    start: number;
    end: number;
    text: string;
};

type Snippet = {
    id: string;
    problemId: string;
    title: string;
    content: string;
    language: SupportedLanguage;
    lengthCategory: SnippetLength;
    difficulty: Difficulty;
    lines: number;
    sourceSlug?: string;
    frontendId?: number;
    tokens?: Token[];
};

type DatasetSnippet = {
    id?: string;
    lang?: string;
    difficulty?: string;
    title?: string;
    content?: string;
    lines?: number;
    lengthCategory?: string;
    problemId?: string;
    frontendId?: number;
    sourceSlug?: string;
};

const DATA_DIR = "data";
const INPUT_FILE = join(DATA_DIR, "leetcode-snippets.json");
const ALGORITHMS_FILE = join(DATA_DIR, "algorithms-snippets.json");
const OUTPUT_FILE = join(DATA_DIR, "snippets-processed.json");
const LANGUAGES: SupportedLanguage[] = ["javascript", "python", "java", "cpp"];

const LENGTH_THRESHOLDS = {
    short: 10,
    medium: 30,
} as const;

function stripComments(content: string, language: SupportedLanguage): string {
    if (language === "python") {
        let cleaned = content.replace(/#.*$/gm, "");
        cleaned = cleaned.replace(/"""[\s\S]*?"""/g, "");
        cleaned = cleaned.replace(/'''[\s\S]*?'''/g, "");
        return cleaned;
    } else {
        let cleaned = content.replace(/\/\*[\s\S]*?\*\//g, "");
        cleaned = cleaned.replace(/\/\/.*$/gm, "");
        return cleaned;
    }
}

function condenseBlankRuns(content: string): string {
    const lines = content.split("\n");
    const result: string[] = [];
    let blankRun = 0;
    for (const line of lines) {
        const isBlank = line.trim().length === 0;
        if (isBlank) {
            blankRun += 1;
            if (result.length === 0) continue;
            if (blankRun > 1) continue;
        } else {
            blankRun = 0;
        }
        result.push(line);
    }
    while (result.length > 0 && result[result.length - 1].trim().length === 0) {
        result.pop();
    }
    return result.join("\n");
}

function normalizeContent(content: string): string {
    const normalized = content.replace(/\r\n/g, "\n");
    const cleaned = condenseBlankRuns(normalized);
    const trimmed = cleaned.trimEnd();
    if (!trimmed) return "\n";
    return trimmed.endsWith("\n") ? trimmed : `${trimmed}\n`;
}

function sanitizeContentForLanguage(content: string, language: SupportedLanguage): string {
    return stripComments(content, language);
}

function countLines(content: string): number {
    if (!content) return 0;
    return content.split("\n").length - 1;
}

function classifyLength(lines: number): SnippetLength {
    if (lines <= LENGTH_THRESHOLDS.short) return "short";
    if (lines <= LENGTH_THRESHOLDS.medium) return "medium";
    return "long";
}

function computeProblemId(language: SupportedLanguage, slug: string): string {
    return `${language}:${slug}`;
}

function isSupportedLanguage(value: unknown): value is SupportedLanguage {
    return value === "javascript" || value === "python" || value === "java" || value === "cpp";
}

function isDifficulty(value: unknown): value is Difficulty {
    return value === "easy" || value === "medium" || value === "hard";
}

// ---------------------------------------------------------------------------
// Tokenizer (inline for build-time self-containment)
// ---------------------------------------------------------------------------

const KEYWORD_SETS: Record<SupportedLanguage, Set<string>> = {
    javascript: new Set([
        "abstract","arguments","async","await","boolean","break","byte","case","catch",
        "char","class","const","continue","debugger","default","delete","do","double",
        "else","enum","export","extends","false","final","finally","float","for",
        "function","goto","if","implements","import","in","instanceof","int","interface",
        "let","long","native","new","null","of","package","private","protected","public",
        "return","short","static","super","switch","synchronized","this","throw","throws",
        "transient","true","try","typeof","undefined","var","void","volatile","while","with","yield",
    ]),
    python: new Set([
        "False","None","True","and","as","assert","async","await","break","class",
        "continue","def","del","elif","else","except","finally","for","from","global",
        "if","import","in","is","lambda","nonlocal","not","or","pass","raise","return",
        "try","while","with","yield",
    ]),
    java: new Set([
        "abstract","assert","boolean","break","byte","case","catch","char","class",
        "const","continue","default","do","double","else","enum","extends","false",
        "final","finally","float","for","goto","if","implements","import","instanceof",
        "int","interface","long","native","new","null","package","private","protected",
        "public","return","short","static","strictfp","super","switch","synchronized",
        "this","throw","throws","transient","true","try","void","volatile","while",
    ]),
    cpp: new Set([
        "alignas","alignof","and","auto","bool","break","case","catch","char","class",
        "const","constexpr","continue","default","delete","do","double","dynamic_cast",
        "else","enum","explicit","export","extern","false","float","for","friend","goto",
        "if","inline","int","long","mutable","namespace","new","noexcept","not","nullptr",
        "operator","or","private","protected","public","register","return","short","signed",
        "sizeof","static","static_cast","struct","switch","template","this","throw","true",
        "try","typedef","typename","union","unsigned","using","virtual","void","volatile",
        "while","std","string","vector","map","set","size_t",
    ]),
};

const DELIMITERS = new Set(["(",")","{","}","[","]",",",";",":","."]);
const OPERATOR_CHARS = new Set(["+","-","*","/","%","=","<",">","!","&","|","^","~","?","@"]);

function tokenize(content: string, language: SupportedLanguage): Token[] {
    const keywords = KEYWORD_SETS[language];
    const tokens: Token[] = [];
    let i = 0;
    while (i < content.length) {
        const ch = content[i];
        if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
            const start = i;
            while (i < content.length && (content[i] === " " || content[i] === "\t" || content[i] === "\n" || content[i] === "\r")) i++;
            tokens.push({ category: "whitespace", start, end: i, text: content.slice(start, i) });
            continue;
        }
        if (ch === '"' || ch === "'" || ch === "`") {
            const start = i;
            const q = ch;
            if (language === "python" && i + 2 < content.length && content[i+1] === q && content[i+2] === q) {
                i += 3;
                while (i + 2 < content.length && !(content[i] === q && content[i+1] === q && content[i+2] === q)) i++;
                i = Math.min(i + 3, content.length);
                tokens.push({ category: "string", start, end: i, text: content.slice(start, i) });
                continue;
            }
            i++;
            while (i < content.length && content[i] !== q) { if (content[i] === "\\") i++; i++; }
            if (i < content.length) i++;
            tokens.push({ category: "string", start, end: i, text: content.slice(start, i) });
            continue;
        }
        if (ch === "/" && i + 1 < content.length && content[i+1] === "/") {
            const start = i;
            while (i < content.length && content[i] !== "\n") i++;
            tokens.push({ category: "comment", start, end: i, text: content.slice(start, i) });
            continue;
        }
        if (ch === "/" && i + 1 < content.length && content[i+1] === "*") {
            const start = i; i += 2;
            while (i + 1 < content.length && !(content[i] === "*" && content[i+1] === "/")) i++;
            i = Math.min(i + 2, content.length);
            tokens.push({ category: "comment", start, end: i, text: content.slice(start, i) });
            continue;
        }
        if (language === "python" && ch === "#") {
            const start = i;
            while (i < content.length && content[i] !== "\n") i++;
            tokens.push({ category: "comment", start, end: i, text: content.slice(start, i) });
            continue;
        }
        if (ch >= "0" && ch <= "9") {
            const start = i;
            while (i < content.length && /[0-9a-fA-FxXoObB._eE+\-]/.test(content[i])) i++;
            tokens.push({ category: "literal", start, end: i, text: content.slice(start, i) });
            continue;
        }
        if (/[a-zA-Z_$]/.test(ch)) {
            const start = i;
            while (i < content.length && /[a-zA-Z0-9_$]/.test(content[i])) i++;
            const text = content.slice(start, i);
            tokens.push({ category: keywords.has(text) ? "keyword" : "identifier", start, end: i, text });
            continue;
        }
        if (DELIMITERS.has(ch)) {
            tokens.push({ category: "delimiter", start: i, end: i + 1, text: ch });
            i++; continue;
        }
        if (OPERATOR_CHARS.has(ch)) {
            const start = i;
            while (i < content.length && OPERATOR_CHARS.has(content[i])) i++;
            tokens.push({ category: "operator", start, end: i, text: content.slice(start, i) });
            continue;
        }
        tokens.push({ category: "identifier", start: i, end: i + 1, text: ch });
        i++;
    }
    return tokens;
}

function normalizeDataset(raw: unknown): Snippet[] {
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((entry: DatasetSnippet): Snippet[] => {
        if (!entry || typeof entry !== "object") return [];
        if (!isSupportedLanguage(entry.lang)) return [];
        if (typeof entry.content !== "string" || entry.content.length === 0) return [];

        const sanitizedContent = sanitizeContentForLanguage(entry.content, entry.lang);
        const normalizedContent = normalizeContent(sanitizedContent);
        const lines = countLines(normalizedContent);
        const lengthCategory = classifyLength(lines);
        const difficulty = isDifficulty(entry.difficulty) ? entry.difficulty : "easy";
        const title = typeof entry.title === "string" && entry.title.length > 0 ? entry.title : "LeetCode snippet";
        const sourceSlug = typeof entry.sourceSlug === "string" ? entry.sourceSlug : undefined;
        const fallbackProblemId =
            typeof entry.id === "string" && entry.id.length > 0 ? entry.id : computeProblemId(entry.lang, "snippet");
        const problemId =
            typeof entry.problemId === "string" && entry.problemId.length > 0
                ? entry.problemId
                : computeProblemId(entry.lang, sourceSlug ?? fallbackProblemId);
        const id = typeof entry.id === "string" && entry.id.length > 0 ? entry.id : problemId;
        const frontendId =
            typeof entry.frontendId === "number" && Number.isFinite(entry.frontendId) ? entry.frontendId : undefined;

        if (isSkeletal(normalizedContent, entry.lang)) return [];

        return [
            {
                id,
                problemId,
                title,
                content: normalizedContent,
                language: entry.lang,
                lengthCategory,
                difficulty,
                lines,
                sourceSlug,
                frontendId,
            },
        ];
    });
}

async function main() {
    console.log("Building pre-processed snippets...");
    
    const startTime = performance.now();
    
    // Read raw data: LeetCode starter code plus (optionally) real snippets
    // synced from TheAlgorithms via scripts/sync-algorithms.ts.
    const leetcode = JSON.parse(await readFile(INPUT_FILE, "utf-8"));
    let algorithms: unknown[] = [];
    try {
        algorithms = JSON.parse(await readFile(ALGORITHMS_FILE, "utf-8"));
    } catch {
        // Optional source; run `bun run sync:algorithms` to populate it.
    }
    const dataset = [...leetcode, ...(Array.isArray(algorithms) ? algorithms : [])];
    console.log(
        `Loaded ${leetcode.length} LeetCode + ${Array.isArray(algorithms) ? algorithms.length : 0} algorithm snippets (${dataset.length} total)`,
    );
    
    // Normalize
    const normalized = normalizeDataset(dataset);
    console.log(`Normalized to ${normalized.length} usable snippets (filtered out ${dataset.length - normalized.length} skeletal/empty)`);

    // Tokenize validation (ensure all snippets can be tokenized at runtime)
    let tokenCount = 0;
    for (const snippet of normalized) {
        tokenCount += tokenize(snippet.content, snippet.language).length;
    }
    console.log(`Validated tokenization for ${normalized.length} snippets (${tokenCount} total tokens)`);

    // Write per-language files for fast progressive loading
    const byLanguage: Record<SupportedLanguage, Snippet[]> = {
        javascript: [],
        python: [],
        java: [],
        cpp: [],
    };
    
    for (const snippet of normalized) {
        byLanguage[snippet.language].push(snippet);
    }
    
    // Write individual language files
    for (const lang of LANGUAGES) {
        const langFile = join(DATA_DIR, `snippets-${lang}.json`);
        await writeFile(langFile, JSON.stringify(byLanguage[lang]));
        const { size } = await Bun.file(langFile).stat();
        console.log(`  ${lang}: ${byLanguage[lang].length} snippets (${(size / 1024).toFixed(0)}KB)`);
    }
    
    // Write combined file as fallback
    await writeFile(OUTPUT_FILE, JSON.stringify(normalized));
    
    const elapsed = (performance.now() - startTime).toFixed(0);
    console.log(`Wrote all files in ${elapsed}ms`);
    
    // Show file size comparison
    const { size: inputSize } = await Bun.file(INPUT_FILE).stat();
    const { size: outputSize } = await Bun.file(OUTPUT_FILE).stat();
    console.log(`Total size: ${(inputSize / 1024 / 1024).toFixed(2)}MB -> ${(outputSize / 1024 / 1024).toFixed(2)}MB`);
}

void main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

