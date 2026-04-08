/**
 * AI Drills Types
 * Shared types for the AI-powered drill generation system
 */

import type { SupportedLanguage, SnippetLength, Difficulty } from "@/lib/snippets";
import type { WeakPattern } from "@/lib/pattern-analysis";

// ---------------------------------------------------------------------------
// Request/Response Types
// ---------------------------------------------------------------------------

export type DrillRequest = {
    language: SupportedLanguage;
    difficulty: Difficulty;
    lengthCategory: SnippetLength;
    weakPatterns: WeakPattern[];
    targetTokenCategories: string[];
    recentDrillTitles: string[];
    userContext: {
        estimatedWpm: number;
        estimatedAccuracy: number;
        sessionCount: number;
    };
};

export type DrillResponse = {
    title: string;
    content: string;
    explanation: string;
    focusAreas: string[];
    reasoning: string;
    estimatedDifficulty: Difficulty;
};

export type GeneratedDrill = DrillResponse & {
    provider: "claude" | "openai" | "fireworks";
    model: string;
    tokensUsed: number;
    costUsd: number;
};

// ---------------------------------------------------------------------------
// API Route Types
// ---------------------------------------------------------------------------

export type GenerateApiRequest = DrillRequest;

export type GenerateApiResponse = {
    snippet: DrillResponse;
    provider: "claude" | "openai" | "fireworks";
    model: string;
    tokensUsed: number;
    costUsd: number;
};

export type GenerateApiError = {
    error: string;
    code: string;
    details?: unknown;
    reason?: string;
};

// ---------------------------------------------------------------------------
// Rate Limiter Types
// ---------------------------------------------------------------------------

export interface RateLimiterState {
    minuteTimestamps: number[];
    hourTimestamps: number[];
    dayTimestamps: number[];
    lastRequestMs: number;
}

export interface RateLimitCheckResult {
    allowed: boolean;
    reason?: string;
    retryAfterMs?: number;
}

// ---------------------------------------------------------------------------
// AI Metadata Types (stored with CustomSnippetRecord)
// ---------------------------------------------------------------------------

export type AIMetadata = {
    provider: "claude" | "openai" | "fireworks";
    model: string;
    reasoning: string;           // why this drill was generated
    focusAreas: string[];        // token categories targeted
    weakPatternsInput: string[]; // what was sent to the AI
    tokensUsed: number;
    costUsd: number;
    accepted: boolean;
    difficulty: Difficulty;
    lengthCategory: SnippetLength;
};
