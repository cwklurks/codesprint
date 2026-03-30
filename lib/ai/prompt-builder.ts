/**
 * Prompt Builder
 * Constructs prompts for AI drill generation with stdlib allowlists
 */

import { z } from "zod";
import type { DrillRequest } from "./types";
import type { SupportedLanguage, SnippetLength, Difficulty } from "@/lib/snippets";

// ---------------------------------------------------------------------------
// Stdlib Allowlists
// ---------------------------------------------------------------------------

const STDLIB_ALLOWLISTS: Record<SupportedLanguage, string[]> = {
    python: [
        "collections", "itertools", "functools", "math", "typing",
        "dataclasses", "abc", "enum", "re", "json", "os", "sys",
        "pathlib", "datetime", "random", "string", "heapq", "bisect",
        "operator", "copy", "io", "contextlib",
    ],
    java: [
        "java.util", "java.io", "java.lang", "java.math",
        "java.util.stream", "java.util.function", "java.time",
        "java.util.concurrent", "java.nio",
    ],
    cpp: [
        "vector", "string", "map", "unordered_map", "set",
        "unordered_set", "algorithm", "numeric", "iostream",
        "sstream", "fstream", "memory", "functional", "utility",
        "queue", "stack", "deque", "array", "tuple", "optional",
        "variant", "any", "cassert", "cmath", "cstdio", "cstdlib",
        "climits", "iterator", "stdexcept", "type_traits",
    ],
    javascript: [],  // No imports allowed (everything is global)
};

// ---------------------------------------------------------------------------
// Line Count Ranges
// ---------------------------------------------------------------------------

const LINE_RANGES: Record<SnippetLength, { min: number; max: number }> = {
    short:  { min: 3,  max: 10 },
    medium: { min: 11, max: 30 },
    long:   { min: 31, max: 60 },
};

// ---------------------------------------------------------------------------
// Response Schema for AI SDK
// ---------------------------------------------------------------------------

export const drillResponseSchema = z.object({
    title: z.string().describe("Short descriptive name, e.g. 'Binary Search Iterator'"),
    content: z.string().describe("The actual code to type"),
    explanation: z.string().describe("1-2 sentences about what the code does"),
    focusAreas: z.array(z.string()).describe("Token categories this drills"),
    reasoning: z.string().describe("Why this drill was chosen for this user"),
    estimatedDifficulty: z.enum(["easy", "medium", "hard"]),
});

// ---------------------------------------------------------------------------
// Prompt Construction
// ---------------------------------------------------------------------------

function getSystemPrompt(language: SupportedLanguage, minLines: number, maxLines: number, targetPatterns: string[]): string {
    const stdlibAllowlist = STDLIB_ALLOWLISTS[language];
    const stdlibSection = stdlibAllowlist.length > 0
        ? `3. Standard library imports are ALLOWED: ${stdlibAllowlist.join(", ")}\n4. Third-party/external imports are FORBIDDEN`
        : `3. No imports allowed (everything is global)`;

    return `You are a code drill generator for CodeSprint, a typing practice app for
programmers. You generate short, self-contained code snippets that users
will type to improve their coding speed and accuracy.

RULES:
1. Code MUST be syntactically valid ${language}
2. Code MUST be self-contained
${stdlibSection}
5. Code MUST NOT include comments explaining it's AI-generated
6. Code MUST be between ${minLines} and ${maxLines} lines
7. Code SHOULD emphasize these syntax patterns: ${targetPatterns.join(", ") || "balanced mix"}
8. Code SHOULD be realistic, something a developer would actually write
9. Code SHOULD cover a single, coherent concept or algorithm
10. Code difficulty level: appropriate to user skill
11. Do NOT generate offensive, harmful, or inappropriate code
12. Do NOT generate code with security vulnerabilities as the pattern

Respond with valid JSON matching the provided schema.`;
}

function getUserPrompt(
    language: SupportedLanguage,
    difficulty: Difficulty,
    lengthCategory: SnippetLength,
    minLines: number,
    maxLines: number,
    weakPatterns: DrillRequest["weakPatterns"],
    userContext: DrillRequest["userContext"],
    recentDrillTitles: string[]
): string {
    const weakPatternsText = weakPatterns.length > 0
        ? weakPatterns.map((p) => `- ${p.label}: ${Math.round((1 - p.errorRate) * 100)}% accuracy (${p.errorCount} errors)`).join("\n")
        : "- Default focus: keywords, operators, delimiters";

    const recentTitlesText = recentDrillTitles.length > 0
        ? recentDrillTitles.join(", ")
        : "None yet";

    return `Generate a ${difficulty} ${language} coding drill.

Target length: ${lengthCategory} (${minLines}-${maxLines} lines)

The user's weak areas (prioritize these syntax patterns):
${weakPatternsText}

The user's current skill level:
- Estimated WPM: ${userContext.estimatedWpm}
- Estimated Accuracy: ${Math.round(userContext.estimatedAccuracy * 100)}%
- Sessions completed: ${userContext.sessionCount}

Recent drill titles to avoid repeating themes:
${recentTitlesText}

Generate a drill that specifically exercises the user's weak patterns
while remaining at an appropriate difficulty level.`;
}

/**
 * Build prompts for AI drill generation
 */
export function buildPrompt(request: DrillRequest): { systemPrompt: string; userPrompt: string } {
    const { min, max } = LINE_RANGES[request.lengthCategory];
    const targetPatterns = request.targetTokenCategories;

    const systemPrompt = getSystemPrompt(
        request.language,
        min,
        max,
        targetPatterns
    );

    const userPrompt = getUserPrompt(
        request.language,
        request.difficulty,
        request.lengthCategory,
        min,
        max,
        request.weakPatterns,
        request.userContext,
        request.recentDrillTitles
    );

    return { systemPrompt, userPrompt };
}

/**
 * Get the stdlib allowlist for a language
 */
export function getStdlibAllowlist(language: SupportedLanguage): string[] {
    return [...STDLIB_ALLOWLISTS[language]];
}

/**
 * Check if an import is allowed for a language
 */
export function isImportAllowed(language: SupportedLanguage, importName: string): boolean {
    const allowlist = STDLIB_ALLOWLISTS[language];
    if (allowlist.length === 0) return false; // No imports allowed

    return allowlist.some((allowed) => 
        importName === allowed || importName.startsWith(`${allowed}.`)
    );
}
