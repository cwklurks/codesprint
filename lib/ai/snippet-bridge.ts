/**
 * Snippet Bridge
 * Converts CustomSnippetRecord (from IndexedDB) to Snippet type
 * for use with the existing snippet system
 */

import type { CustomSnippetRecord } from "@/lib/storage/idb-store";
import type { Snippet, SupportedLanguage, SnippetLength, Difficulty } from "@/lib/snippets";

const LENGTH_THRESHOLDS = {
    short: 10,
    medium: 30,
} as const;

function classifyLength(lines: number): SnippetLength {
    if (lines <= LENGTH_THRESHOLDS.short) return "short";
    if (lines <= LENGTH_THRESHOLDS.medium) return "medium";
    return "long";
}

/**
 * Convert a CustomSnippetRecord to a Snippet
 */
export function toSnippet(record: CustomSnippetRecord): Snippet {
    const lines = record.content.split("\n").length;
    const lengthCategory: SnippetLength =
        record.aiMetadata?.lengthCategory 
            ? (record.aiMetadata.lengthCategory as SnippetLength)
            : classifyLength(lines);
    
    const difficulty: Difficulty =
        (record.aiMetadata?.difficulty as Difficulty) ?? "medium";

    return {
        id: record.id,
        problemId: `ai-drill-${record.id}`,    // stable, unique
        title: record.title,
        content: record.content,
        language: record.language as SupportedLanguage,
        lengthCategory,
        difficulty,
        lines,
    };
}

/**
 * Check if a CustomSnippetRecord is an AI drill
 */
export function isAIDrill(record: CustomSnippetRecord): boolean {
    return record.source === "ai";
}

/**
 * Check if a CustomSnippetRecord is an accepted AI drill
 */
export function isAcceptedAIDrill(record: CustomSnippetRecord): boolean {
    return record.source === "ai" && record.aiMetadata?.accepted === true;
}
