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

type SupportedLanguage = "javascript" | "python" | "java" | "cpp";
type SnippetLength = "short" | "medium" | "long";
type Difficulty = "easy" | "medium" | "hard";

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
const OUTPUT_FILE = join(DATA_DIR, "snippets-processed.json");
const LANGUAGES: SupportedLanguage[] = ["javascript", "python", "java", "cpp"];

const LENGTH_THRESHOLDS = {
    short: 10,
    medium: 30,
} as const;

function isSkeletal(content: string, language: SupportedLanguage): boolean {
    const lines = content.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    let substantiveLines = 0;

    if (language === "javascript") {
        for (const line of lines) {
            if (
                !line.match(/^var .* = function\s*\(.*\)\s*{\s*$/) &&
                !line.match(/.*\.prototype\..* = function\s*\(.*\)\s*{\s*$/) &&
                !line.match(/^class /) &&
                !line.match(/^constructor/) &&
                !line.match(/^[}\]];?$/)
            ) {
                substantiveLines++;
            }
        }
    } else if (language === "python") {
        for (const line of lines) {
            if (
                !line.match(/^def .*:$/) &&
                !line.match(/^class /) &&
                !line.match(/^@/) &&
                !line.match(/^pass$/)
            ) {
                substantiveLines++;
            }
        }
    } else {
        return false;
    }

    return substantiveLines < 1;
}

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
    
    // Read raw data
    const rawData = await readFile(INPUT_FILE, "utf-8");
    const dataset = JSON.parse(rawData);
    console.log(`Loaded ${dataset.length} raw snippets from ${INPUT_FILE}`);
    
    // Normalize
    const normalized = normalizeDataset(dataset);
    console.log(`Normalized to ${normalized.length} usable snippets (filtered out ${dataset.length - normalized.length} skeletal/empty)`);
    
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

