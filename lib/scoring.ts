"use client";

import type { Token, CachedTokenArray } from "./tokenizer";
import { _pscCache, _calcCache } from "./tokenizer";
import { getCachedWeights } from "./token-weights";
import type { TokenWeights } from "./token-weights";
import type { SupportedLanguage } from "./snippets";

export type Metrics = {
    rawWpm: number;
    adjustedWpm: number;
    accuracy: number;
    patternScore?: number;
};

const MS_IN_MINUTE = 1000 * 60;

type ComputeMetricsInput = {
    correctProgress: number;
    elapsedMs: number;
    totalTyped: number;
    totalKeystrokes?: number;
    correctKeystrokes?: number;
};

export function computeMetrics({ correctProgress, elapsedMs, totalTyped, totalKeystrokes, correctKeystrokes }: ComputeMetricsInput): Metrics {
    if (elapsedMs <= 0) {
        return { rawWpm: 0, adjustedWpm: 0, accuracy: 1 };
    }
    const minutes = elapsedMs / MS_IN_MINUTE;
    const rawCount = totalKeystrokes ?? totalTyped;
    const rawWpm = (rawCount / 5) / minutes;
    const adjustedWpm = Math.max(0, (correctProgress / 5) / minutes);
    const accuracy =
        !totalKeystrokes || totalKeystrokes <= 0
            ? 1
            : Math.min(1, (correctKeystrokes ?? 0) / totalKeystrokes);

    return { rawWpm, adjustedWpm, accuracy };
}

// ---------------------------------------------------------------------------
// Pattern Score
// ---------------------------------------------------------------------------

function totalWeightFromTokens(tokens: Token[], weights: TokenWeights): number {
    let total = 0;
    for (let t = 0; t < tokens.length; t++) {
        const tok = tokens[t];
        total += weights[tok.category] * (tok.end - tok.start);
    }
    return total;
}

function weightAtPosition(tokens: Token[], pos: number, weights: TokenWeights): number {
    let lo = 0, hi = tokens.length - 1;
    while (lo <= hi) {
        const mid = (lo + hi) >>> 1;
        const tok = tokens[mid];
        if (pos < tok.start) hi = mid - 1;
        else if (pos >= tok.end) lo = mid + 1;
        else return weights[tok.category];
    }
    return weights.whitespace;
}

type PatternScoreInput = {
    errorPositions: number[];
    tokens: Token[];
    contentLength: number;
    language: SupportedLanguage;
};

// Named property cache — faster than Symbol in JSC (hidden class optimized)
export function computePatternScore(input: PatternScoreInput): number {
    const c = _pscCache[(input.tokens as CachedTokenArray)._id];
    return c && c[0] === input.errorPositions ? c[1] : _computePatternScoreCold(input);
}

function _computePatternScoreCold(input: PatternScoreInput): number {
    const tokens = input.tokens;
    if (tokens.length === 0 || input.contentLength === 0) return 100;

    const weights = getCachedWeights(input.language);
    const totalWeight = totalWeightFromTokens(tokens, weights);
    if (totalWeight === 0) return 100;

    const errorPositions = input.errorPositions;
    const contentLength = input.contentLength;
    let errorWeight = 0;
    for (let j = 0; j < errorPositions.length; j++) {
        const pos = errorPositions[j];
        if (pos >= 0 && pos < contentLength) {
            errorWeight += weightAtPosition(tokens, pos, weights);
        }
    }

    const score = Math.round(((totalWeight - errorWeight) / totalWeight) * 100);
    const result = Math.max(0, Math.min(100, score));
    _pscCache[(tokens as CachedTokenArray)._id] = [errorPositions, result];
    return result;
}

// ---------------------------------------------------------------------------
// createPatternScoreCalculator
// ---------------------------------------------------------------------------

type PatternScoreCalculatorInput = {
    tokens: Token[];
    contentLength: number;
    language: SupportedLanguage;
};

export function createPatternScoreCalculator(
    input: PatternScoreCalculatorInput
): (errorPositions: number[]) => number {
    return _calcCache[(input.tokens as CachedTokenArray)._id] || _createCalcCold(input);
}

function _createCalcCold(
    input: PatternScoreCalculatorInput,
): (errorPositions: number[]) => number {
    const tokens = input.tokens;
    if (tokens.length === 0 || input.contentLength === 0) {
        return () => 100;
    }

    const weights = getCachedWeights(input.language);
    const totalWeight = totalWeightFromTokens(tokens, weights);
    if (totalWeight === 0) {
        const fn = () => 100;
        _calcCache[(tokens as CachedTokenArray)._id] = fn;
        return fn;
    }

    const contentLength = input.contentLength;
    let lastKey: number[] | null = null;
    let lastVal = 0;

    const fn = (errorPositions: number[]): number => {
        if (lastKey === errorPositions) return lastVal;
        if (errorPositions.length === 0) return 100;

        let errorWeight = 0;
        for (let j = 0; j < errorPositions.length; j++) {
            const pos = errorPositions[j];
            if (pos >= 0 && pos < contentLength) {
                errorWeight += weightAtPosition(tokens, pos, weights);
            }
        }
        const score = Math.round(((totalWeight - errorWeight) / totalWeight) * 100);
        const result = Math.max(0, Math.min(100, score));
        lastKey = errorPositions;
        lastVal = result;
        return result;
    };

    _calcCache[(tokens as CachedTokenArray)._id] = fn;
    return fn;
}
