/**
 * /api/generate route hardening.
 *
 * Covers the CSRF origin policy (including the `Origin: null` case that used to
 * throw inside `new URL()`) and the request-body bounds that keep an attacker
 * from posting an unbounded prompt through someone else's key.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const generateText = vi.fn();

vi.mock("ai", () => ({
    generateText: (...args: unknown[]) => generateText(...args),
    Output: { object: vi.fn(() => ({})) },
}));

vi.mock("@ai-sdk/anthropic", () => ({
    createAnthropic: vi.fn(() => vi.fn(() => ({ id: "anthropic-model" }))),
}));

vi.mock("@ai-sdk/openai", () => ({
    createOpenAI: vi.fn(() => vi.fn(() => ({ id: "openai-model" }))),
}));

vi.mock("@/lib/ai/response-parser", () => ({
    validateDrillResponse: vi.fn(() => ({ valid: true })),
}));

const HOST = "codesprint.dev";
const ORIGIN = `https://${HOST}`;
const VALID_KEY = "sk-ant-0123456789abcdefghij";

const validBody = () => ({
    language: "python",
    difficulty: "easy",
    lengthCategory: "short",
    weakPatterns: [
        { category: "keyword", errorCount: 3, totalTokens: 40, errorRate: 0.075, label: "Keywords" },
    ],
    targetTokenCategories: ["keyword"],
    recentDrillTitles: ["Binary search"],
    userContext: { estimatedWpm: 62, estimatedAccuracy: 0.94, sessionCount: 12 },
});

type RequestOptions = {
    origin?: string | null;
    host?: string | null;
    authorization?: string | null;
    body?: unknown;
    contentLength?: string;
};

function makeRequest(options: RequestOptions = {}): Request {
    const {
        origin = ORIGIN,
        host = HOST,
        authorization = `Bearer ${VALID_KEY}`,
        body = validBody(),
        contentLength,
    } = options;

    const headers = new Headers({ "content-type": "application/json" });
    if (origin !== null) headers.set("origin", origin);
    if (host !== null) headers.set("host", host);
    if (authorization !== null) headers.set("authorization", authorization);
    if (contentLength !== undefined) headers.set("content-length", contentLength);

    return new Request(`${ORIGIN}/api/generate`, {
        method: "POST",
        headers,
        body: typeof body === "string" ? body : JSON.stringify(body),
    });
}

async function post(options: RequestOptions = {}) {
    const { POST } = await import("@/app/api/generate/route");
    const response = await POST(makeRequest(options));
    return { status: response.status, json: await response.json() };
}

beforeEach(() => {
    generateText.mockReset();
    generateText.mockResolvedValue({
        output: {
            title: "Drill",
            content: "def f():\n    return 1\n",
            explanation: "why",
            focusAreas: ["keyword"],
            reasoning: "because",
            estimatedDifficulty: "easy",
        },
        usage: { totalTokens: 500 },
    });
});

describe("POST /api/generate — origin policy", () => {
    it("accepts a same-host origin", async () => {
        const { status } = await post();
        expect(status).toBe(200);
    });

    it("rejects a cross-origin request", async () => {
        const { status, json } = await post({ origin: "https://evil.example" });
        expect(status).toBe(403);
        expect(json.code).toBe("ORIGIN_MISMATCH");
        expect(generateText).not.toHaveBeenCalled();
    });

    it("rejects an opaque `Origin: null` header without throwing", async () => {
        const { status, json } = await post({ origin: "null" });
        expect(status).toBe(403);
        expect(json.code).toBe("ORIGIN_MISMATCH");
    });

    it("rejects a malformed origin", async () => {
        const { status, json } = await post({ origin: "not a url" });
        expect(status).toBe(403);
        expect(json.code).toBe("ORIGIN_MISMATCH");
    });

    it("rejects a request with no Origin header at all", async () => {
        const { status, json } = await post({ origin: null });
        expect(status).toBe(403);
        expect(json.code).toBe("ORIGIN_MISMATCH");
        expect(generateText).not.toHaveBeenCalled();
    });

    it("rejects when the Host header is missing", async () => {
        const { status, json } = await post({ host: null });
        expect(status).toBe(403);
        expect(json.code).toBe("ORIGIN_MISMATCH");
    });

    it("checks the origin before the API key", async () => {
        const { status, json } = await post({ origin: null, authorization: null });
        expect(status).toBe(403);
        expect(json.code).toBe("ORIGIN_MISMATCH");
    });
});

describe("POST /api/generate — key handling", () => {
    it("rejects a missing Authorization header", async () => {
        const { status, json } = await post({ authorization: null });
        expect(status).toBe(401);
        expect(json.code).toBe("NO_KEY");
    });

    it("rejects a too-short key", async () => {
        const { status, json } = await post({ authorization: "Bearer sk-ant-short" });
        expect(status).toBe(400);
        expect(json.code).toBe("INVALID_KEY");
    });

    it("never echoes the API key back to the client", async () => {
        const { json } = await post({ authorization: "Bearer zz-unknown-prefix-key-1234" });
        expect(JSON.stringify(json)).not.toContain("zz-unknown-prefix-key-1234");
    });
});

describe("POST /api/generate — body bounds", () => {
    it("rejects invalid JSON", async () => {
        const { status, json } = await post({ body: "{not json" });
        expect(status).toBe(400);
        expect(json.code).toBe("INVALID_JSON");
    });

    it("rejects too many weak patterns", async () => {
        const body = validBody();
        body.weakPatterns = Array.from({ length: 64 }, () => ({
            category: "keyword" as const,
            errorCount: 1,
            totalTokens: 10,
            errorRate: 0.1,
            label: "Keywords",
        }));
        const { status, json } = await post({ body });
        expect(status).toBe(400);
        expect(json.code).toBe("VALIDATION_ERROR");
    });

    it("rejects an oversized weak-pattern label", async () => {
        const body = validBody();
        body.weakPatterns[0].label = "x".repeat(5_000);
        const { status, json } = await post({ body });
        expect(status).toBe(400);
        expect(json.code).toBe("VALIDATION_ERROR");
    });

    it("rejects an out-of-range error rate", async () => {
        const body = validBody();
        body.weakPatterns[0].errorRate = 42;
        const { status, json } = await post({ body });
        expect(status).toBe(400);
        expect(json.code).toBe("VALIDATION_ERROR");
    });

    it("accepts a weighted error rate above 1 (the client sends 1.5-1.6)", async () => {
        const body = validBody();
        body.weakPatterns[0].errorRate = 1.6;
        const { status } = await post({ body });
        expect(status).toBe(200);
    });

    it("rejects a negative error count", async () => {
        const body = validBody();
        body.weakPatterns[0].errorCount = -1;
        const { status, json } = await post({ body });
        expect(status).toBe(400);
        expect(json.code).toBe("VALIDATION_ERROR");
    });

    it("rejects too many recent drill titles", async () => {
        const body = validBody();
        body.recentDrillTitles = Array.from({ length: 200 }, (_, i) => `Drill ${i}`);
        const { status, json } = await post({ body });
        expect(status).toBe(400);
        expect(json.code).toBe("VALIDATION_ERROR");
    });

    it("rejects an oversized drill title", async () => {
        const body = validBody();
        body.recentDrillTitles = ["t".repeat(10_000)];
        const { status, json } = await post({ body });
        expect(status).toBe(400);
        expect(json.code).toBe("VALIDATION_ERROR");
    });

    it("rejects too many target token categories", async () => {
        const body = validBody();
        body.targetTokenCategories = Array.from({ length: 100 }, () => "keyword");
        const { status, json } = await post({ body });
        expect(status).toBe(400);
        expect(json.code).toBe("VALIDATION_ERROR");
    });

    it("rejects an out-of-range accuracy", async () => {
        const body = validBody();
        body.userContext.estimatedAccuracy = 12;
        const { status, json } = await post({ body });
        expect(status).toBe(400);
        expect(json.code).toBe("VALIDATION_ERROR");
    });

    it("rejects an absurd WPM", async () => {
        const body = validBody();
        body.userContext.estimatedWpm = 10_000;
        const { status, json } = await post({ body });
        expect(status).toBe(400);
        expect(json.code).toBe("VALIDATION_ERROR");
    });

    it("still accepts the empty-arrays payload the key tester sends", async () => {
        const body = {
            ...validBody(),
            weakPatterns: [],
            targetTokenCategories: [],
            recentDrillTitles: [],
        };
        const { status } = await post({ body });
        expect(status).toBe(200);
    });
});

describe("POST /api/generate — the real client payload", () => {
    it("accepts the exact cold-start request buildDrillRequest produces", async () => {
        const { buildDrillRequest } = await import("@/lib/ai/skill-feed");
        const body = await buildDrillRequest("python", {});

        // Cold start: no sessions, no skill model — the language defaults, whose
        // weighted error rates are 1.5/1.5/0.7, are what actually goes on the wire.
        expect(body.weakPatterns.some((p) => p.errorRate > 1)).toBe(true);

        const { status, json } = await post({ body });
        expect(json.code).toBeUndefined();
        expect(status).toBe(200);
    });
});

describe("POST /api/generate — oversized bodies", () => {
    it("rejects a body whose declared length exceeds the cap, before parsing it", async () => {
        const { status, json } = await post({ contentLength: "5000000" });
        expect(status).toBe(413);
        expect(json.code).toBe("BODY_TOO_LARGE");
        expect(generateText).not.toHaveBeenCalled();
    });

    it("accepts a normally sized declared length", async () => {
        const { status } = await post({ contentLength: "512" });
        expect(status).toBe(200);
    });
});

describe("POST /api/generate — platform limits", () => {
    it("declares a maxDuration that outlives the in-app abort", async () => {
        const route = await import("@/app/api/generate/route");
        expect(route.maxDuration).toBe(30);
    });

    it("aborts generation before the platform kills the function", async () => {
        await post();
        const options = generateText.mock.calls[0][0] as { abortSignal?: AbortSignal };
        expect(options.abortSignal).toBeInstanceOf(AbortSignal);
    });
});
