/**
 * Response Parser & Validation Pipeline
 * Validates AI-generated drills through 6 layers of checks
 */

import { z } from "zod";
import type { DrillRequest, DrillResponse } from "./types";
import type { SupportedLanguage } from "@/lib/snippets";
import { tokenize } from "@/lib/tokenizer";
import { getStdlibAllowlist } from "./prompt-builder";
import { drillResponseSchema } from "./prompt-builder";

// ---------------------------------------------------------------------------
// Validation Result Types
// ---------------------------------------------------------------------------

export type ValidationResult = 
    | { valid: true }
    | { valid: false; reason: string; code: string };

// ---------------------------------------------------------------------------
// Validation Pipeline
// ---------------------------------------------------------------------------

const DEDUP_THRESHOLD = 0.85;

/**
 * Run full validation pipeline on a drill response
 */
export function validateDrillResponse(
    response: unknown,
    request: DrillRequest,
    existingDrills: DrillResponse[] = []
): ValidationResult {
    // 1. Schema validation
    const schemaResult = validateSchema(response);
    if (!schemaResult.valid) return schemaResult;

    const drill = schemaResult.data;

    // 2. Line count check
    const lineResult = validateLineCount(drill, request.lengthCategory);
    if (!lineResult.valid) return lineResult;

    // 3. Import check
    const importResult = validateImports(drill.content, request.language);
    if (!importResult.valid) return importResult;

    // 4. Delimiter balance check
    const delimiterResult = validateDelimiters(drill.content);
    if (!delimiterResult.valid) return delimiterResult;

    // 5. Tokenizer dry-run
    const tokenResult = validateTokenizer(drill.content, request.language);
    if (!tokenResult.valid) return tokenResult;

    // 6. Jaccard dedup (against existing AI drills only)
    const dedupResult = validateDedup(drill, existingDrills);
    if (!dedupResult.valid) return dedupResult;

    return { valid: true };
}

// ---------------------------------------------------------------------------
// Individual Validators
// ---------------------------------------------------------------------------

function validateSchema(response: unknown): { valid: true; data: DrillResponse } | { valid: false; reason: string; code: string } {
    const result = drillResponseSchema.safeParse(response);
    if (!result.success) {
        return {
            valid: false,
            reason: `Schema validation failed: ${result.error.issues.map((e: z.ZodIssue) => e.message).join(", ")}`,
            code: "SCHEMA_ERROR",
        };
    }
    return { valid: true, data: result.data };
}

function validateLineCount(drill: DrillResponse, lengthCategory: "short" | "medium" | "long"): ValidationResult {
    const lines = drill.content.split("\n").length;
    
    // Allow +/- 20% flexibility from target ranges
    const ranges = {
        short: { min: 3, max: 10, tolerance: 2 },
        medium: { min: 11, max: 30, tolerance: 6 },
        long: { min: 31, max: 60, tolerance: 12 },
    };
    
    const range = ranges[lengthCategory];
    const effectiveMin = range.min - range.tolerance;
    const effectiveMax = range.max + range.tolerance;
    
    if (lines < effectiveMin || lines > effectiveMax) {
        return {
            valid: false,
            reason: `Line count ${lines} is outside acceptable range (${effectiveMin}-${effectiveMax}) for ${lengthCategory}`,
            code: "LINE_COUNT",
        };
    }
    
    return { valid: true };
}

function validateImports(content: string, language: SupportedLanguage): ValidationResult {
    const violations: string[] = [];
    const allowlist = getStdlibAllowlist(language);
    const lines = content.split("\n");

    for (const line of lines) {
        const trimmed = line.trim();

        if (language === "python") {
            const match = trimmed.match(/^(?:from\s+(\w+)|import\s+(\w+))/);
            if (match) {
                const moduleName = match[1] ?? match[2];
                if (!allowlist.includes(moduleName)) {
                    violations.push(moduleName);
                }
            }
        } else if (language === "java") {
            const match = trimmed.match(/^import\s+([\w.]+)/);
            if (match) {
                const pkg = match[1];
                if (!allowlist.some((a) => pkg.startsWith(a))) {
                    violations.push(pkg);
                }
            }
        } else if (language === "cpp") {
            const match = trimmed.match(/^#include\s*<(\w+)>/);
            if (match) {
                if (!allowlist.includes(match[1])) {
                    violations.push(match[1]);
                }
            }
            // Reject #include "..." (local headers)
            if (trimmed.match(/^#include\s*"/)) {
                violations.push(trimmed);
            }
        } else if (language === "javascript") {
            // Reject all import/require statements
            if (trimmed.match(/^import\s/) || trimmed.match(/require\(/)) {
                violations.push(trimmed);
            }
        }
    }

    if (violations.length > 0) {
        return {
            valid: false,
            reason: `Disallowed imports/modules: ${violations.slice(0, 3).join(", ")}${violations.length > 3 ? "..." : ""}`,
            code: "IMPORT_VIOLATION",
        };
    }

    return { valid: true };
}

function validateDelimiters(content: string): ValidationResult {
    const counts = {
        "{": 0, "}": 0,
        "(": 0, ")": 0,
        "[": 0, "]": 0,
    };

    let inString = false;
    let stringChar = "";
    let escaped = false;

    for (const char of content) {
        if (escaped) {
            escaped = false;
            continue;
        }

        if (char === "\\") {
            escaped = true;
            continue;
        }

        if (!inString && (char === '"' || char === "'" || char === "`")) {
            inString = true;
            stringChar = char;
            continue;
        }

        if (inString && char === stringChar) {
            inString = false;
            continue;
        }

        if (!inString) {
            if (char in counts) {
                counts[char as keyof typeof counts]++;
            }
        }
    }

    const mismatches: string[] = [];
    if (counts["{"] !== counts["}"]) mismatches.push(`{/${counts["{"]} vs }/${counts["}"]}`);
    if (counts["("] !== counts[")"]) mismatches.push(`(/${counts["("]} vs )/${counts[")"]}`);
    if (counts["["] !== counts["]"]) mismatches.push(`[/${counts["["]} vs ]/${counts["]"]}`);

    if (mismatches.length > 0) {
        return {
            valid: false,
            reason: `Unbalanced delimiters: ${mismatches.join(", ")}`,
            code: "DELIMITER_IMBALANCE",
        };
    }

    return { valid: true };
}

function validateTokenizer(content: string, language: SupportedLanguage): ValidationResult {
    try {
        const tokens = tokenize(content, language);
        
        // Check that we have some scorable tokens (not just whitespace/comments)
        const scorableTokens = tokens.filter((t) => 
            t.category !== "whitespace" && t.category !== "comment"
        );
        
        if (scorableTokens.length === 0) {
            return {
                valid: false,
                reason: "No scorable tokens found (only whitespace/comments)",
                code: "NO_SCORABLE_TOKENS",
            };
        }

        return { valid: true };
    } catch (error) {
        return {
            valid: false,
            reason: `Tokenizer error: ${error instanceof Error ? error.message : String(error)}`,
            code: "TOKENIZER_ERROR",
        };
    }
}

function validateDedup(drill: DrillResponse, existingDrills: DrillResponse[]): ValidationResult {
    if (existingDrills.length === 0) return { valid: true };

    const drillTokens = tokenizeContent(drill.content);

    for (const existing of existingDrills) {
        const existingTokens = tokenizeContent(existing.content);
        const similarity = jaccardSimilarity(drillTokens, existingTokens);

        if (similarity > DEDUP_THRESHOLD) {
            return {
                valid: false,
                reason: `Too similar to existing drill "${existing.title}" (${Math.round(similarity * 100)}% similar)`,
                code: "DEDUP_VIOLATION",
            };
        }
    }

    return { valid: true };
}

// ---------------------------------------------------------------------------
// Jaccard Similarity
// ---------------------------------------------------------------------------

function tokenizeContent(content: string): string[] {
    // Simple tokenization: split by whitespace and punctuation, normalize
    return content
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length > 1); // Filter out single chars for better comparison
}

function jaccardSimilarity(tokensA: string[], tokensB: string[]): number {
    const setA = new Set(tokensA);
    const setB = new Set(tokensB);
    
    const intersection = new Set([...setA].filter((x) => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    
    if (union.size === 0) return 0;
    return intersection.size / union.size;
}
