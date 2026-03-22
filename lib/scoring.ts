"use client";

import type { Token } from "./tokenizer";
import { buildCategoryMap } from "./tokenizer";
import { getWeights } from "./token-weights";
import type { SupportedLanguage } from "./snippets";

export type Metrics = {
    rawWpm: number;
    adjustedWpm: number;
    accuracy: number;
    patternScore?: number;
};

const MS_IN_MINUTE = 1000 * 60;

type ComputeMetricsInput = {
    correctProgress: number; // Characters in perfect words
    elapsedMs: number;
    totalTyped: number; // Total characters currently in the buffer (cursor position) - kept for legacy/other uses
    totalKeystrokes?: number; // Total keys pressed (including backspaces)
    correctKeystrokes?: number; // Total correct keys pressed
};

export function computeMetrics({ correctProgress, elapsedMs, totalTyped, totalKeystrokes, correctKeystrokes }: ComputeMetricsInput): Metrics {
    if (elapsedMs <= 0) {
        return { rawWpm: 0, adjustedWpm: 0, accuracy: 1 };
    }
    const minutes = elapsedMs / MS_IN_MINUTE;

    // Raw WPM: (Total Keystrokes / 5) / Time
    // We use totalKeystrokes if available, otherwise fallback to totalTyped (backward compatibility/safety)
    const rawCount = totalKeystrokes ?? totalTyped;
    const rawWpm = (rawCount / 5) / minutes;

    // Adjusted WPM: (Characters in Perfect Words / 5) / Time
    // correctProgress now represents "sum of lengths of perfect words"
    const adjustedWpm = Math.max(0, (correctProgress / 5) / minutes);

    // Accuracy: Correct Keystrokes / Total Keystrokes
    const accuracy =
        !totalKeystrokes || totalKeystrokes <= 0
            ? 1
            : Math.min(1, (correctKeystrokes ?? 0) / totalKeystrokes);

    return {
        rawWpm,
        adjustedWpm,
        accuracy,
    };
}

// ---------------------------------------------------------------------------
// Pattern Score
// ---------------------------------------------------------------------------

type PatternScoreInput = {
    /** Error positions in the content string */
    errorPositions: number[];
    /** Tokens from the tokenizer */
    tokens: Token[];
    /** Total content length */
    contentLength: number;
    /** Language for weight lookup */
    language: SupportedLanguage;
};

/**
 * Compute a pattern score (0-100) that reflects how well the user typed
 * syntax-significant tokens.
 *
 * Higher score = fewer errors on high-weight tokens.
 * A perfect run = 100.
 */
export function computePatternScore({
    errorPositions,
    tokens,
    contentLength,
    language,
}: PatternScoreInput): number {
    if (tokens.length === 0 || contentLength === 0) return 100;

    const categoryMap = buildCategoryMap(tokens, contentLength);
    const weights = getWeights(language);

    // Total weighted characters and weighted errors
    let totalWeight = 0;
    let errorWeight = 0;

    const errorSet = new Set(errorPositions);

    for (let i = 0; i < contentLength; i++) {
        const category = categoryMap[i];
        const w = weights[category];
        totalWeight += w;
        if (errorSet.has(i)) {
            errorWeight += w;
        }
    }

    if (totalWeight === 0) return 100;

    const score = Math.round(((totalWeight - errorWeight) / totalWeight) * 100);
    return Math.max(0, Math.min(100, score));
}

// ---------------------------------------------------------------------------
// createPatternScoreCalculator - cached version of computePatternScore
// ---------------------------------------------------------------------------

type PatternScoreCalculatorInput = {
    tokens: Token[];
    contentLength: number;
    language: SupportedLanguage;
};

/**
 * Creates a reusable pattern score calculator that caches the categoryMap and
 * totalWeight for a given snippet. Call this once per snippet and reuse the
 * returned function on every keystroke interval to avoid rebuilding the map.
 */
export function createPatternScoreCalculator({
    tokens,
    contentLength,
    language,
}: PatternScoreCalculatorInput): (errorPositions: number[]) => number {
    if (tokens.length === 0 || contentLength === 0) {
        return () => 100;
    }

    const categoryMap = buildCategoryMap(tokens, contentLength);
    const weights = getWeights(language);

    let totalWeight = 0;
    for (let i = 0; i < contentLength; i++) {
        totalWeight += weights[categoryMap[i]];
    }

    if (totalWeight === 0) {
        return () => 100;
    }

    return (errorPositions: number[]): number => {
        if (errorPositions.length === 0) return 100;
        let errorWeight = 0;
        const errorSet = new Set(errorPositions);
        for (const pos of errorSet) {
            if (pos >= 0 && pos < contentLength) {
                errorWeight += weights[categoryMap[pos]];
            }
        }
        const score = Math.round(((totalWeight - errorWeight) / totalWeight) * 100);
        return Math.max(0, Math.min(100, score));
    };
}
