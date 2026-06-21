import { describe, it, expect, beforeEach } from "vitest";
import {
    storeApiKey,
    getApiKey,
    clearApiKey,
    hasApiKey,
    getActiveProvider,
    getActiveApiKey,
    detectProviderFromKey,
} from "../key-storage";

beforeEach(() => {
    sessionStorage.clear();
});

describe("key-storage", () => {
    it("stores and retrieves a key for a provider", () => {
        storeApiKey("claude", "sk-ant-test-key-123456");
        expect(getApiKey("claude")).toBe("sk-ant-test-key-123456");
        expect(hasApiKey("claude")).toBe(true);
    });

    it("returns null when no key is stored", () => {
        expect(getApiKey("openai")).toBeNull();
        expect(hasApiKey("openai")).toBe(false);
    });

    it("clears a key for a provider", () => {
        storeApiKey("openai", "sk-test-key-1234567890");
        expect(hasApiKey("openai")).toBe(true);
        clearApiKey("openai");
        expect(hasApiKey("openai")).toBe(false);
        expect(getApiKey("openai")).toBeNull();
    });

    it("does not persist to localStorage", () => {
        storeApiKey("fireworks", "fw-test-key-1234567890");
        expect(localStorage.getItem("codesprint-ai-key-fireworks")).toBeNull();
    });

    it("uses sessionStorage", () => {
        storeApiKey("fireworks", "fw-test-key-1234567890");
        expect(sessionStorage.getItem("codesprint-ai-key-fireworks")).toBe("fw-test-key-1234567890");
    });

    it("returns the active provider preferring claude > openai > fireworks", () => {
        expect(getActiveProvider()).toBeNull();

        storeApiKey("fireworks", "fw-test-key-1234567890");
        expect(getActiveProvider()).toBe("fireworks");

        storeApiKey("openai", "sk-test-key-1234567890");
        expect(getActiveProvider()).toBe("openai");

        storeApiKey("claude", "sk-ant-test-key-123456");
        expect(getActiveProvider()).toBe("claude");
    });

    it("returns the active API key", () => {
        storeApiKey("claude", "sk-ant-test-key-123456");
        expect(getActiveApiKey()).toBe("sk-ant-test-key-123456");
    });

    it("returns null active key when no provider has a key", () => {
        expect(getActiveApiKey()).toBeNull();
    });

    it("detects provider from key prefix", () => {
        expect(detectProviderFromKey("sk-ant-something")).toBe("claude");
        expect(detectProviderFromKey("fw-something")).toBe("fireworks");
        expect(detectProviderFromKey("sk-something")).toBe("openai");
        expect(detectProviderFromKey("sk-proj-something")).toBe("openai");
        expect(detectProviderFromKey("unknown-prefix")).toBeNull();
    });

    it("isolates keys per provider", () => {
        storeApiKey("claude", "sk-ant-key-aaa");
        storeApiKey("openai", "sk-key-bbb");
        expect(getApiKey("claude")).toBe("sk-ant-key-aaa");
        expect(getApiKey("openai")).toBe("sk-key-bbb");
    });
});
