import { afterEach, describe, expect, it, vi } from "vitest";

import { getSiteHost, getSiteUrl } from "../site";

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("getSiteUrl", () => {
    it("prefers NEXT_PUBLIC_SITE_URL when set", () => {
        vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://codesprint.example");
        vi.stubEnv("NEXT_PUBLIC_VERCEL_URL", "vercel-preview.vercel.app");
        expect(getSiteUrl()).toBe("https://codesprint.example");
    });

    it("falls back to https-prefixed NEXT_PUBLIC_VERCEL_URL when SITE_URL is absent", () => {
        vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
        vi.stubEnv("NEXT_PUBLIC_VERCEL_URL", "vercel-preview.vercel.app");
        expect(getSiteUrl()).toBe("https://vercel-preview.vercel.app");
    });

    it("falls back to localhost when neither env var is set", () => {
        vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
        vi.stubEnv("NEXT_PUBLIC_VERCEL_URL", "");
        expect(getSiteUrl()).toBe("http://localhost:3000");
    });

    it("strips a single trailing slash from NEXT_PUBLIC_SITE_URL", () => {
        vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://codesprint.example/");
        expect(getSiteUrl()).toBe("https://codesprint.example");
    });

    it("strips multiple trailing slashes", () => {
        vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://codesprint.example///");
        expect(getSiteUrl()).toBe("https://codesprint.example");
    });

    it("does not double the https prefix when VERCEL_URL already has a protocol", () => {
        vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
        vi.stubEnv("NEXT_PUBLIC_VERCEL_URL", "https://vercel-preview.vercel.app/");
        expect(getSiteUrl()).toBe("https://vercel-preview.vercel.app");
    });
});

describe("getSiteHost", () => {
    it("returns the host without protocol for an https url", () => {
        vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://codesprint.example");
        expect(getSiteHost()).toBe("codesprint.example");
    });

    it("returns the host without protocol for the localhost fallback", () => {
        vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
        vi.stubEnv("NEXT_PUBLIC_VERCEL_URL", "");
        expect(getSiteHost()).toBe("localhost:3000");
    });

    it("drops a trailing slash from the host", () => {
        vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://codesprint.example/");
        expect(getSiteHost()).toBe("codesprint.example");
    });

    it("derives the host from a vercel preview url", () => {
        vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
        vi.stubEnv("NEXT_PUBLIC_VERCEL_URL", "vercel-preview.vercel.app");
        expect(getSiteHost()).toBe("vercel-preview.vercel.app");
    });
});
