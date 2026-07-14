import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/generate/route";

const validBody = {
    language: "python",
    difficulty: "medium",
    lengthCategory: "short",
    weakPatterns: [],
    targetTokenCategories: [],
    recentDrillTitles: [],
    userContext: {
        estimatedWpm: 40,
        estimatedAccuracy: 0.95,
        sessionCount: 10,
    },
};

function makeRequest(
    body: unknown = validBody,
    headers: Record<string, string> = {},
    url = "https://codesprint.app/api/generate",
): Request {
    return new Request(url, {
        method: "POST",
        headers: {
            authorization: `Bearer sk-test-${"x".repeat(32)}`,
            "content-type": "application/json",
            origin: "https://codesprint.app",
            ...headers,
        },
        body: JSON.stringify(body),
    });
}

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("AI generation request boundaries", () => {
    it.each(["null", "not a valid origin"])(
        "rejects the malformed origin %j without throwing",
        async (origin) => {
            vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://codesprint.app");

            const response = await POST(makeRequest(validBody, { origin }));

            expect(response.status).toBe(403);
            await expect(response.json()).resolves.toMatchObject({ code: "INVALID_ORIGIN" });
        },
    );

    it("rejects requests without an Origin header", async () => {
        vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://codesprint.app");
        const request = makeRequest();
        request.headers.delete("origin");

        const response = await POST(request);

        expect(response.status).toBe(403);
        await expect(response.json()).resolves.toMatchObject({ code: "INVALID_ORIGIN" });
    });

    it("allows the canonical origin before validating the body", async () => {
        vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");

        const response = await POST(makeRequest({ ...validBody, unexpected: true }));

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    });

    it("allows same-origin localhost requests during local development and tests", async () => {
        vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");

        const response = await POST(makeRequest(
            { ...validBody, unexpected: true },
            { origin: "http://localhost:3010" },
            "http://localhost:3010/api/generate",
        ));

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    });

    it("rejects an oversized declared body before parsing JSON", async () => {
        vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://codesprint.app");

        const response = await POST(makeRequest(validBody, { "content-length": "65536" }));

        expect(response.status).toBe(413);
        await expect(response.json()).resolves.toMatchObject({ code: "PAYLOAD_TOO_LARGE" });
    });

    it.each([
        ["too many weak patterns", {
            ...validBody,
            weakPatterns: Array.from({ length: 9 }, () => ({
                category: "keyword",
                errorCount: 1,
                totalTokens: 10,
                errorRate: 0.1,
                label: "Keywords",
            })),
        }],
        ["an overlong recent title", {
            ...validBody,
            recentDrillTitles: ["x".repeat(121)],
        }],
        ["out-of-range user metrics", {
            ...validBody,
            userContext: { ...validBody.userContext, estimatedAccuracy: 2 },
        }],
    ])("rejects %s", async (_description, body) => {
        vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://codesprint.app");

        const response = await POST(makeRequest(body));

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    });
});
