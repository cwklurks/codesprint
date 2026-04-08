/**
 * AI Drill Generation API Route
 * Proxies requests to Claude or OpenAI with user-provided API key
 */

import { generateText, Output } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { buildPrompt, drillResponseSchema } from "@/lib/ai/prompt-builder";
import { validateDrillResponse } from "@/lib/ai/response-parser";
import type { DrillRequest, GenerateApiResponse, GenerateApiError } from "@/lib/ai/types";
import { detectProviderFromKey } from "@/lib/ai/key-storage";

const drillRequestSchema = z.object({
    language: z.enum(["javascript", "python", "java", "cpp"]),
    difficulty: z.enum(["easy", "medium", "hard"]),
    lengthCategory: z.enum(["short", "medium", "long"]),
    weakPatterns: z.array(z.object({
        category: z.enum(["keyword", "operator", "delimiter", "identifier", "literal", "string", "comment", "whitespace"]),
        errorCount: z.number(),
        totalTokens: z.number(),
        errorRate: z.number(),
        label: z.string(),
    })),
    targetTokenCategories: z.array(z.string()),
    recentDrillTitles: z.array(z.string()),
    userContext: z.object({
        estimatedWpm: z.number(),
        estimatedAccuracy: z.number(),
        sessionCount: z.number(),
    }),
});

export async function POST(request: Request) {
    // 1. Origin validation (CSRF protection)
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (origin && new URL(origin).host !== (host ?? "")) {
        const error: GenerateApiError = { 
            error: "Forbidden", 
            code: "ORIGIN_MISMATCH" 
        };
        return Response.json(error, { status: 403 });
    }

    // 2. Read API key from Authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
        const error: GenerateApiError = {
            error: "Configure your API key in settings",
            code: "NO_KEY",
        };
        return Response.json(error, { status: 401 });
    }
    const apiKey = authHeader.slice(7);
    if (apiKey.length < 20) {
        const error: GenerateApiError = {
            error: "Invalid API key",
            code: "INVALID_KEY",
        };
        return Response.json(error, { status: 400 });
    }

    // 3. Parse + validate request body
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        const error: GenerateApiError = {
            error: "Invalid JSON in request body",
            code: "INVALID_JSON",
        };
        return Response.json(error, { status: 400 });
    }

    const parseResult = drillRequestSchema.safeParse(body);
    if (!parseResult.success) {
        const error: GenerateApiError = {
            error: "Invalid request",
            code: "VALIDATION_ERROR",
            details: parseResult.error.flatten(),
        };
        return Response.json(error, { status: 400 });
    }
    const drillRequest = parseResult.data;

    // 4. Determine provider from key prefix
    const provider = detectProviderFromKey(apiKey);
    if (!provider) {
        const error: GenerateApiError = {
            error: "Unrecognized API key format",
            code: "INVALID_KEY_FORMAT",
        };
        return Response.json(error, { status: 400 });
    }

    // 5. Build prompt
    const { systemPrompt, userPrompt } = buildPrompt(drillRequest);

    // 6. Call AI SDK
    try {
        // Create provider with API key
        const model = provider === "claude"
            ? createAnthropic({ apiKey })("claude-haiku-4-5-20251001")
            : provider === "fireworks"
            ? createOpenAI({ apiKey, baseURL: "https://api.fireworks.ai/inference/v1" })("accounts/fireworks/models/llama-v3p1-70b-instruct")
            : createOpenAI({ apiKey })("gpt-4o-mini");

        const result = await generateText({
            model,
            system: systemPrompt,
            prompt: userPrompt,
            output: Output.object({ schema: drillResponseSchema }),
            maxOutputTokens: 2048,
            abortSignal: AbortSignal.timeout(30_000),
        });

        const drillResponse = result.output;

        // 7. Validate generated code
        const validation = validateDrillResponse(
            drillResponse,
            drillRequest as DrillRequest,
        );
        if (!validation.valid) {
            const error: GenerateApiError = {
                error: "Generated code was invalid, try again",
                code: "VALIDATION_FAILED",
                reason: validation.reason,
            };
            return Response.json(error, { status: 422 });
        }

        // 8. Return response with cost info
        const response: GenerateApiResponse = {
            snippet: drillResponse,
            provider,
            model: provider === "claude"
                ? "claude-haiku-4-5"
                : provider === "fireworks"
                ? "llama-v3p1-70b-instruct"
                : "gpt-4o-mini",
            tokensUsed: result.usage?.totalTokens ?? 0,
            costUsd: estimateCost(result.usage?.totalTokens ?? 0, provider),
        };
        return Response.json(response);
    } catch (error: unknown) {
        // Provider-specific error handling
        if (isAuthError(error)) {
            const err: GenerateApiError = {
                error: "Check your API key",
                code: "AUTH_ERROR",
            };
            return Response.json(err, { status: 401 });
        }
        if (isRateLimitError(error)) {
            const err: GenerateApiError = {
                error: "Provider rate limited, try again shortly",
                code: "RATE_LIMITED",
            };
            return Response.json(err, { status: 429 });
        }
        if (isTimeoutError(error)) {
            const err: GenerateApiError = {
                error: "Generation timed out, try again",
                code: "TIMEOUT",
            };
            return Response.json(err, { status: 504 });
        }
        
        const err: GenerateApiError = {
            error: "Generation failed",
            code: "UNKNOWN",
        };
        return Response.json(err, { status: 500 });
    }
}

function estimateCost(totalTokens: number, provider: string): number {
    if (provider === "claude") {
        // Haiku: avg ~$3/M tokens (input + output blended)
        return (totalTokens * 3) / 1_000_000;
    }
    if (provider === "fireworks") {
        // Llama 3.1 70B: ~$0.9/M tokens
        return (totalTokens * 0.9) / 1_000_000;
    }
    // GPT-4o-mini: avg ~$0.375/M tokens (input + output blended)
    return (totalTokens * 0.375) / 1_000_000;
}

function isAuthError(error: unknown): boolean {
    return error instanceof Error && (
        error.message.includes("401") ||
        error.message.includes("auth") ||
        error.message.includes("invalid_api_key") ||
        error.message.includes("unauthorized")
    );
}

function isRateLimitError(error: unknown): boolean {
    return error instanceof Error && (
        error.message.includes("429") ||
        error.message.includes("rate_limit") ||
        error.message.includes("rate limit")
    );
}

function isTimeoutError(error: unknown): boolean {
    return error instanceof Error && (
        error.name === "AbortError" ||
        error.message.includes("timeout") ||
        error.message.includes("timed out")
    );
}
