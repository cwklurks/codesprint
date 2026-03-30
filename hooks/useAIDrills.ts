"use client";

import { useState, useCallback, useRef } from "react";
import { buildDrillRequest } from "@/lib/ai/skill-feed";
import { toSnippet } from "@/lib/ai/snippet-bridge";
import type { Snippet, SupportedLanguage } from "@/lib/snippets";
import type { DrillRequest, DrillResponse, GenerateApiResponse, GenerateApiError } from "@/lib/ai/types";
import type { CustomSnippetRecord } from "@/lib/storage/idb-store";
import { checkRateLimit, recordRequest, getRemainingToday } from "@/lib/ai/rate-limiter";
import { getActiveApiKey, getActiveProvider, type AIProvider } from "@/lib/ai/key-storage";
import { idbPut, STORES } from "@/lib/storage/idb-store";

export type AIDrillState = 
    | { status: "idle" }
    | { status: "loading" }
    | { status: "preview"; drill: DrillResponse; costUsd: number; provider: AIProvider }
    | { status: "error"; error: string; code?: string };

export interface UseAIDrillsReturn {
    state: AIDrillState;
    generateDrill: (language: SupportedLanguage) => Promise<void>;
    acceptDrill: () => Promise<Snippet | null>;
    rejectDrill: () => void;
    reset: () => void;
    canGenerate: boolean;
    remainingToday: number;
    rateLimitReason?: string;
}

export function useAIDrills(
    preferences: {
        aiDrillsEnabled: boolean;
        aiMaxDrillsPerDay: number;
        aiDrillLengthPreference: "short" | "medium" | "long" | "auto";
    }
): UseAIDrillsReturn {
    const [state, setState] = useState<AIDrillState>({ status: "idle" });
    const currentDrillRef = useRef<DrillResponse | null>(null);
    const currentDrillMetaRef = useRef<{ provider: AIProvider; costUsd: number; tokensUsed: number } | null>(null);
    const currentRequestRef = useRef<DrillRequest | null>(null);

    const canGenerate = preferences.aiDrillsEnabled && getActiveApiKey() !== null;

    const generateDrill = useCallback(async (language: SupportedLanguage) => {
        if (!canGenerate) {
            setState({ status: "error", error: "AI drills not enabled or no API key configured" });
            return;
        }

        // Check rate limits
        const rateCheck = checkRateLimit(preferences.aiMaxDrillsPerDay);
        if (!rateCheck.allowed) {
            setState({ status: "error", error: rateCheck.reason ?? "Rate limited", code: "RATE_LIMIT" });
            return;
        }

        setState({ status: "loading" });

        try {
            // Build the drill request
            const request = await buildDrillRequest(language, {
                aiDrillLengthPreference: preferences.aiDrillLengthPreference,
            });
            currentRequestRef.current = request;

            // Get API key
            const apiKey = getActiveApiKey();
            const provider = getActiveProvider();
            if (!apiKey || !provider) {
                setState({ status: "error", error: "No API key configured", code: "NO_KEY" });
                return;
            }

            // Call the API
            const response = await fetch("/api/generate", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`,
                },
                body: JSON.stringify(request),
            });

            if (!response.ok) {
                const error = await response.json() as GenerateApiError;
                setState({ status: "error", error: error.error, code: error.code });
                return;
            }

            const data = await response.json() as GenerateApiResponse;
            
            // Record the request for rate limiting
            recordRequest();

            // Store drill for preview
            currentDrillRef.current = data.snippet;
            currentDrillMetaRef.current = {
                provider,
                costUsd: data.costUsd,
                tokensUsed: data.tokensUsed,
            };

            setState({
                status: "preview",
                drill: data.snippet,
                costUsd: data.costUsd,
                provider,
            });
        } catch (error) {
            // Error already captured in state
            setState({ 
                status: "error", 
                error: error instanceof Error ? error.message : "Generation failed",
                code: "UNKNOWN"
            });
        }
    }, [canGenerate, preferences.aiMaxDrillsPerDay, preferences.aiDrillLengthPreference]);

    const acceptDrill = useCallback(async (): Promise<Snippet | null> => {
        const drill = currentDrillRef.current;
        const meta = currentDrillMetaRef.current;
        const request = currentRequestRef.current;

        if (!drill || !meta || !request) {
            return null;
        }

        try {
            // Create the custom snippet record
            const record: CustomSnippetRecord = {
                id: crypto.randomUUID(),
                title: drill.title,
                content: drill.content,
                language: request.language,
                createdAt: new Date().toISOString(),
                source: "ai",
                aiMetadata: {
                    provider: meta.provider,
                    model: meta.provider === "claude" ? "claude-3-haiku" : "gpt-4o-mini",
                    reasoning: drill.reasoning,
                    focusAreas: drill.focusAreas,
                    weakPatternsInput: request.targetTokenCategories,
                    tokensUsed: meta.tokensUsed,
                    costUsd: meta.costUsd,
                    accepted: true,
                    difficulty: request.difficulty,
                    lengthCategory: request.lengthCategory,
                },
            };

            // Save to IndexedDB
            await idbPut(STORES.customSnippets, record);

            // Convert to Snippet and return
            const snippet = toSnippet(record);

            // Reset state
            setState({ status: "idle" });
            currentDrillRef.current = null;
            currentDrillMetaRef.current = null;
            currentRequestRef.current = null;

            return snippet;
        } catch (_error) {
            // Error surfaced via state
            setState({ status: "error", error: "Failed to save drill", code: "SAVE_ERROR" });
            return null;
        }
    }, []);

    const rejectDrill = useCallback(() => {
        currentDrillRef.current = null;
        currentDrillMetaRef.current = null;
        currentRequestRef.current = null;
        setState({ status: "idle" });
    }, []);

    const reset = useCallback(() => {
        currentDrillRef.current = null;
        currentDrillMetaRef.current = null;
        currentRequestRef.current = null;
        setState({ status: "idle" });
    }, []);

    const remainingToday = getRemainingToday(preferences.aiMaxDrillsPerDay);

    return {
        state,
        generateDrill,
        acceptDrill,
        rejectDrill,
        reset,
        canGenerate,
        remainingToday,
        rateLimitReason: state.status === "error" && state.code === "RATE_LIMIT" ? state.error : undefined,
    };
}
