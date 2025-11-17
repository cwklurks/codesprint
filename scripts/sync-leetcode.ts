#!/usr/bin/env bun

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

type SupportedLanguage = "python" | "javascript" | "java" | "cpp";
type Difficulty = "easy" | "medium" | "hard";
type SnippetLength = "short" | "medium" | "long";

type ProblemMeta = {
    slug: string;
    title: string;
    frontendId: number;
    difficulty: Difficulty;
    paidOnly: boolean;
};

type QuestionDetail = {
    title: string;
    frontendId: number;
    codeSnippets: { lang: string; langSlug?: string; code: string }[];
    difficulty: Difficulty;
    paidOnly: boolean;
};

type CliOptions = {
    stripComments: boolean;
    minLines: number;
    maxLines: number | null;
    limit: number | null;
    difficulties: Difficulty[] | null;
};

type SnippetRecord = {
    id: string;
    lang: SupportedLanguage;
    difficulty: Difficulty;
    title: string;
    content: string;
    lines: number;
    lengthCategory: SnippetLength;
    problemId: string;
    frontendId: number;
    sourceSlug: string;
};

const DATA_DIR = "data";
const OUTPUT_FILE = join(DATA_DIR, "leetcode-snippets.json");
const API_URL = "https://leetcode.com/graphql";
const LIST_URL = "https://leetcode.com/api/problems/all/";

const LENGTH_RANGES: Record<SnippetLength, number> = {
    short: 15,
    medium: 40,
    long: Number.POSITIVE_INFINITY,
};

const LANGUAGE_ORDER: Record<SupportedLanguage, number> = {
    javascript: 0,
    python: 1,
    java: 2,
    cpp: 3,
};

const LENGTH_ORDER: Record<SnippetLength, number> = {
    short: 0,
    medium: 1,
    long: 2,
};

const DIFFICULTY_ORDER: Record<Difficulty, number> = {
    easy: 0,
    medium: 1,
    hard: 2,
};

const QUESTION_QUERY = `
query questionData($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    questionFrontendId
    title
    difficulty
    isPaidOnly
    codeSnippets {
      lang
      langSlug
      code
    }
  }
}
`;

async function main() {
    const options = parseArgs(Bun.argv.slice(2));
    const difficultyLabel = options.difficulties ? options.difficulties.join(",") : "all";
    const maxLinesLabel = options.maxLines ?? "∞";
    console.log(
        `Starting LeetCode sync (stripComments=${options.stripComments}, minLines=${options.minLines}, maxLines=${maxLinesLabel}, difficulties=${difficultyLabel})`
    );

    const problems = await fetchProblemList();
    console.log(`Fetched ${problems.length} public problems from the catalog`);

    const snippets: SnippetRecord[] = [];
    const seenProblems = new Set<string>();

    for (const [index, problem] of problems.entries()) {
        if (options.limit !== null && snippets.length >= options.limit) break;
        if (problem.paidOnly) continue;
        const detail = await fetchQuestion(problem.slug);
        if (!detail || detail.paidOnly) continue;

        for (const snippet of detail.codeSnippets) {
            const lang = normalizeLang(snippet);
            if (!lang) continue;

            const problemId = computeProblemId(lang, problem.slug);
            if (seenProblems.has(problemId)) continue;

            const prepared = prepareSnippet({
                lang,
                rawCode: snippet.code,
                options,
                title: detail.title,
                difficulty: problem.difficulty,
                sourceSlug: problem.slug,
                frontendId: problem.frontendId,
            });

            if (!prepared) continue;

            snippets.push({
                id: prepared.id,
                lang,
                difficulty: prepared.difficulty,
                title: prepared.title,
                content: prepared.content,
                lines: prepared.lines,
                lengthCategory: prepared.lengthCategory,
                problemId,
                frontendId: prepared.frontendId,
                sourceSlug: prepared.sourceSlug,
            });
            seenProblems.add(problemId);
        }

        if ((index + 1) % 50 === 0) {
            console.log(`Processed ${index + 1} / ${problems.length} problems…`);
        }
    }

    snippets.sort((a, b) => {
        const langDiff = LANGUAGE_ORDER[a.lang] - LANGUAGE_ORDER[b.lang];
        if (langDiff !== 0) return langDiff;
        const lengthDiff = LENGTH_ORDER[a.lengthCategory] - LENGTH_ORDER[b.lengthCategory];
        if (lengthDiff !== 0) return lengthDiff;
        const diffDiff = DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty];
        if (diffDiff !== 0) return diffDiff;
        return a.problemId.localeCompare(b.problemId);
    });

    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(OUTPUT_FILE, `${JSON.stringify(snippets, null, 2)}\n`);
    console.log(`Wrote ${snippets.length} snippets to ${OUTPUT_FILE}`);
}

function parseArgs(argv: string[]): CliOptions {
    const options: CliOptions = { stripComments: false, minLines: 0, maxLines: null, limit: null, difficulties: null };
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === "--strip-comments") {
            options.stripComments = true;
        } else if (arg === "--min-lines") {
            const value = Number(argv[i + 1]);
            if (!Number.isFinite(value) || value < 0) {
                throw new Error("Expected a non-negative number after --min-lines");
            }
            options.minLines = value;
            i += 1;
        } else if (arg === "--max-lines") {
            const value = Number(argv[i + 1]);
            if (!Number.isFinite(value) || value <= 0) {
                throw new Error("Expected a positive number after --max-lines");
            }
            options.maxLines = value;
            i += 1;
        } else if (arg === "--difficulties") {
            const value = argv[i + 1];
            options.difficulties = parseDifficultyList(value);
            i += 1;
        } else if (arg === "--limit") {
            const value = Number(argv[i + 1]);
            if (!Number.isFinite(value) || value <= 0) {
                throw new Error("Expected a positive number after --limit");
            }
            options.limit = value;
            i += 1;
        }
    }
    return options;
}

function parseDifficultyList(raw: string | undefined): Difficulty[] {
    if (!raw) {
        throw new Error("Expected a comma-separated list after --difficulties");
    }
    const normalized = raw
        .split(",")
        .map((chunk) => chunk.trim().toLowerCase())
        .filter(Boolean);
    const valid: Difficulty[] = [];
    for (const value of normalized) {
        if (value === "easy" || value === "medium" || value === "hard") {
            if (!valid.includes(value)) valid.push(value);
        }
    }
    if (valid.length === 0) {
        throw new Error("No valid difficulties supplied. Use any of easy, medium, hard.");
    }
    return valid;
}

async function fetchProblemList(): Promise<ProblemMeta[]> {
    const response = await fetch(LIST_URL, {
        headers: {
            "Content-Type": "application/json",
        },
    });
    if (!response.ok) {
        throw new Error(`Failed to load problem list (${response.status})`);
    }
    const payload = await response.json();
    const pairs = Array.isArray(payload?.stat_status_pairs) ? payload.stat_status_pairs : [];

    return pairs
        .map((entry: unknown): ProblemMeta | null => {
            if (!entry || typeof entry !== "object") return null;
            const record = entry as Record<string, unknown>;
            const stat = record.stat;
            if (!stat || typeof stat !== "object") return null;
            const statRecord = stat as Record<string, unknown>;
            const slugValue = statRecord["question__title_slug"];
            const titleValue = statRecord["question__title"];
            const frontendValue = statRecord["frontend_question_id"];
            const slug = typeof slugValue === "string" ? slugValue : null;
            const title = typeof titleValue === "string" ? titleValue : null;
            const frontendId = Number(frontendValue);
            if (!slug || !title || !Number.isFinite(frontendId)) return null;

            const difficultyRecord = record["difficulty"];
            const difficultyLevel =
                difficultyRecord && typeof difficultyRecord === "object"
                    ? Number((difficultyRecord as Record<string, unknown>).level)
                    : undefined;

            const paidOnly = Boolean(record["paid_only"]);

            return {
                slug,
                title,
                frontendId,
                difficulty: mapDifficulty(difficultyLevel),
                paidOnly,
            };
        })
        .filter((value: ProblemMeta | null): value is ProblemMeta => value !== null);
}

async function fetchQuestion(slug: string): Promise<QuestionDetail | null> {
    const response = await fetch(API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Referer: "https://leetcode.com/",
        },
        body: JSON.stringify({
            operationName: "questionData",
            variables: { titleSlug: slug },
            query: QUESTION_QUERY,
        }),
    });

    if (!response.ok) {
        console.warn(`Failed to fetch question ${slug} (${response.status})`);
        return null;
    }

    const payload = await response.json();
    const question = payload?.data?.question;
    if (!question) {
        console.warn(`Question ${slug} missing in response.`);
        return null;
    }

    return {
        title: question.title,
        frontendId: Number(question.questionFrontendId),
        codeSnippets: Array.isArray(question.codeSnippets) ? question.codeSnippets : [],
        difficulty: mapDifficulty(question.difficulty),
        paidOnly: Boolean(question.isPaidOnly),
    };
}

function mapDifficulty(value: number | string | undefined): Difficulty {
    if (typeof value === "string") {
        const normalized = value.toLowerCase();
        if (normalized === "medium" || normalized === "hard") return normalized;
        return "easy";
    }
    if (value === 3) return "hard";
    if (value === 2) return "medium";
    return "easy";
}

function normalizeLang(snippet: { lang: string; langSlug?: string }): SupportedLanguage | null {
    const candidate = (snippet.langSlug ?? snippet.lang ?? "").toLowerCase();
    if (candidate.includes("python")) return "python";
    if (candidate.includes("javascript") || candidate.includes("typescript")) return "javascript";
    if (candidate === "java") return "java";
    if (candidate === "cpp" || candidate.includes("c++")) return "cpp";
    return null;
}

function stripComments(code: string, lang: SupportedLanguage): string {
    let trimmed = code;
    if (lang === "python") {
        trimmed = trimmed.replace(/^\s*#.*$/gm, "");
    } else {
        trimmed = trimmed.replace(/\/\*[\s\S]*?\*\//g, "");
        trimmed = trimmed.replace(/^\s*\/\/.*$/gm, "");
    }
    return trimmed;
}

function normalizeContent(code: string): string {
    const normalized = code.replace(/\r\n/g, "\n").trimEnd();
    return normalized.endsWith("\n") ? normalized : `${normalized}\n`;
}

function countLines(content: string): number {
    if (!content) return 0;
    return content.split("\n").length - 1;
}

function classifyLength(lines: number): SnippetLength {
    if (lines <= LENGTH_RANGES.short) return "short";
    if (lines <= LENGTH_RANGES.medium) return "medium";
    return "long";
}

function computeProblemId(lang: SupportedLanguage, slug: string): string {
    return `${lang}:${slug}`;
}

function prepareSnippet(args: {
    lang: SupportedLanguage;
    rawCode: string;
    options: CliOptions;
    title: string;
    difficulty: Difficulty;
    sourceSlug: string;
    frontendId: number;
}): SnippetRecord | null {
    const { lang, rawCode, options, difficulty, title, sourceSlug, frontendId } = args;
    if (options.difficulties && options.difficulties.length > 0 && !options.difficulties.includes(difficulty)) {
        return null;
    }
    if (!rawCode) return null;

    const code = options.stripComments ? stripComments(rawCode, lang) : rawCode;
    const normalized = normalizeContent(code);
    const lines = countLines(normalized);
    if (lines < options.minLines) return null;
    if (options.maxLines !== null && lines > options.maxLines) return null;

    return {
        id: `${lang}:${sourceSlug}`,
        lang,
        difficulty,
        title,
        content: normalized,
        lines,
        lengthCategory: classifyLength(lines),
        problemId: computeProblemId(lang, sourceSlug),
        frontendId,
        sourceSlug,
    };
}

void main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
