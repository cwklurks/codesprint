/**
 * BYOK key storage.
 *
 * Safari private browsing (and any browser with site data blocked) throws on
 * every localStorage access; AI drills are optional, so the app must degrade to
 * "no key configured" instead of crashing the render that reads it.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
    storeApiKey,
    getApiKey,
    clearApiKey,
    hasApiKey,
    getActiveProvider,
    getActiveApiKey,
} from "@/lib/ai/key-storage";

const realLocalStorage = window.localStorage;

function useThrowingStorage(): void {
    const throwing = {
        getItem: () => { throw new DOMException("denied", "SecurityError"); },
        setItem: () => { throw new DOMException("denied", "SecurityError"); },
        removeItem: () => { throw new DOMException("denied", "SecurityError"); },
        clear: () => { throw new DOMException("denied", "SecurityError"); },
        key: () => { throw new DOMException("denied", "SecurityError"); },
        length: 0,
    };
    Object.defineProperty(window, "localStorage", { value: throwing, configurable: true });
}

beforeEach(() => {
    realLocalStorage.clear();
});

afterEach(() => {
    Object.defineProperty(window, "localStorage", { value: realLocalStorage, configurable: true });
    realLocalStorage.clear();
});

describe("key-storage with working localStorage", () => {
    it("round-trips a key", () => {
        storeApiKey("claude", "sk-ant-abc");
        expect(getApiKey("claude")).toBe("sk-ant-abc");
        expect(hasApiKey("claude")).toBe(true);
        expect(getActiveProvider()).toBe("claude");
        expect(getActiveApiKey()).toBe("sk-ant-abc");
    });

    it("clears a key", () => {
        storeApiKey("openai", "sk-abc");
        clearApiKey("openai");
        expect(getApiKey("openai")).toBeNull();
        expect(hasApiKey("openai")).toBe(false);
    });
});

describe("key-storage when localStorage is unavailable", () => {
    beforeEach(() => {
        useThrowingStorage();
    });

    it("does not throw on write", () => {
        expect(() => storeApiKey("claude", "sk-ant-abc")).not.toThrow();
    });

    it("reports no key on read", () => {
        expect(getApiKey("claude")).toBeNull();
        expect(hasApiKey("claude")).toBe(false);
    });

    it("does not throw on clear", () => {
        expect(() => clearApiKey("claude")).not.toThrow();
    });

    it("reports no active provider", () => {
        expect(getActiveProvider()).toBeNull();
        expect(getActiveApiKey()).toBeNull();
    });
});
