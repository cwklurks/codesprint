import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    checkRateLimit,
    recordRequest,
    getRemainingToday,
    resetRateLimit,
    getRateLimitState,
} from "@/lib/ai/rate-limiter";

// ---------------------------------------------------------------------------
// Mock localStorage
// ---------------------------------------------------------------------------

const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: vi.fn((key: string) => store[key] ?? null),
        setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
        removeItem: vi.fn((key: string) => { delete store[key]; }),
        clear: vi.fn(() => { store = {}; }),
        get length() { return Object.keys(store).length; },
        key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    };
})();

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
    localStorageMock.clear();
    vi.stubGlobal("localStorage", localStorageMock);
});

// ---------------------------------------------------------------------------
// checkRateLimit
// ---------------------------------------------------------------------------

describe("checkRateLimit", () => {
    it("allows the first request", () => {
        const result = checkRateLimit();
        expect(result.allowed).toBe(true);
    });

    it("enforces cooldown between requests", () => {
        recordRequest();
        const result = checkRateLimit();
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain("Slow down");
        expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    it("allows request after cooldown period", () => {
        // Record a request 3 seconds ago (cooldown is 2 seconds)
        const now = Date.now();
        vi.spyOn(Date, "now").mockReturnValue(now - 3000);
        recordRequest();
        vi.spyOn(Date, "now").mockReturnValue(now);

        const result = checkRateLimit();
        expect(result.allowed).toBe(true);
        vi.restoreAllMocks();
    });

    it("enforces per-minute limit", () => {
        const now = Date.now();
        // Record 5 requests within the last minute (spaced to avoid cooldown)
        for (let i = 0; i < 5; i++) {
            vi.spyOn(Date, "now").mockReturnValue(now - 50_000 + i * 5000);
            recordRequest();
        }
        vi.spyOn(Date, "now").mockReturnValue(now);

        const result = checkRateLimit();
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain("seconds");
        vi.restoreAllMocks();
    });

    it("enforces per-day limit", () => {
        const now = Date.now();
        // Record timestamps for the max daily count
        const maxPerDay = 3;
        for (let i = 0; i < maxPerDay; i++) {
            vi.spyOn(Date, "now").mockReturnValue(now - (maxPerDay - i) * 120_000);
            recordRequest();
        }
        vi.spyOn(Date, "now").mockReturnValue(now);

        const result = checkRateLimit(maxPerDay);
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain("Daily limit reached");
        vi.restoreAllMocks();
    });

    it("returns retryAfterMs when rate limited", () => {
        recordRequest();
        const result = checkRateLimit();
        expect(result.allowed).toBe(false);
        expect(result.retryAfterMs).toBeDefined();
        expect(result.retryAfterMs).toBeGreaterThan(0);
    });
});

// ---------------------------------------------------------------------------
// recordRequest
// ---------------------------------------------------------------------------

describe("recordRequest", () => {
    it("records a timestamp in all three windows", () => {
        recordRequest();
        const state = getRateLimitState();
        expect(state.minuteTimestamps.length).toBe(1);
        expect(state.hourTimestamps.length).toBe(1);
        expect(state.dayTimestamps.length).toBe(1);
        expect(state.lastRequestMs).toBeGreaterThan(0);
    });

    it("accumulates multiple requests", () => {
        const now = Date.now();
        vi.spyOn(Date, "now").mockReturnValue(now - 10_000);
        recordRequest();
        vi.spyOn(Date, "now").mockReturnValue(now);
        recordRequest();

        const state = getRateLimitState();
        expect(state.minuteTimestamps.length).toBe(2);
        expect(state.hourTimestamps.length).toBe(2);
        expect(state.dayTimestamps.length).toBe(2);
        vi.restoreAllMocks();
    });

    it("persists state to localStorage", () => {
        recordRequest();
        expect(localStorageMock.setItem).toHaveBeenCalled();
        const storedKey = localStorageMock.setItem.mock.calls[0][0];
        expect(storedKey).toBe("codesprint-ai-rate-limit");
    });
});

// ---------------------------------------------------------------------------
// getRemainingToday
// ---------------------------------------------------------------------------

describe("getRemainingToday", () => {
    it("returns full quota when no requests made", () => {
        expect(getRemainingToday(100)).toBe(100);
    });

    it("decreases after requests", () => {
        recordRequest();
        expect(getRemainingToday(100)).toBe(99);
    });

    it("returns 0 when quota exhausted", () => {
        const now = Date.now();
        for (let i = 0; i < 5; i++) {
            vi.spyOn(Date, "now").mockReturnValue(now - (5 - i) * 120_000);
            recordRequest();
        }
        vi.spyOn(Date, "now").mockReturnValue(now);

        expect(getRemainingToday(5)).toBe(0);
        vi.restoreAllMocks();
    });

    it("never returns negative", () => {
        const now = Date.now();
        for (let i = 0; i < 10; i++) {
            vi.spyOn(Date, "now").mockReturnValue(now - (10 - i) * 120_000);
            recordRequest();
        }
        vi.spyOn(Date, "now").mockReturnValue(now);

        expect(getRemainingToday(5)).toBe(0);
        vi.restoreAllMocks();
    });

    it("uses default maxPerDay when not specified", () => {
        const remaining = getRemainingToday();
        expect(remaining).toBe(100);
    });
});

// ---------------------------------------------------------------------------
// resetRateLimit
// ---------------------------------------------------------------------------

describe("resetRateLimit", () => {
    it("clears all rate limit state", () => {
        recordRequest();
        resetRateLimit();

        const state = getRateLimitState();
        expect(state.minuteTimestamps.length).toBe(0);
        expect(state.hourTimestamps.length).toBe(0);
        expect(state.dayTimestamps.length).toBe(0);
    });

    it("removes key from localStorage", () => {
        recordRequest();
        resetRateLimit();
        expect(localStorageMock.removeItem).toHaveBeenCalledWith("codesprint-ai-rate-limit");
    });
});

// ---------------------------------------------------------------------------
// getRateLimitState
// ---------------------------------------------------------------------------

describe("getRateLimitState", () => {
    it("returns empty state when nothing recorded", () => {
        const state = getRateLimitState();
        expect(state.minuteTimestamps).toEqual([]);
        expect(state.hourTimestamps).toEqual([]);
        expect(state.dayTimestamps).toEqual([]);
        expect(state.lastRequestMs).toBe(0);
    });

    it("prunes timestamps older than their window", () => {
        const now = Date.now();

        // Record a request 2 minutes ago (should be pruned from minute window)
        vi.spyOn(Date, "now").mockReturnValue(now - 120_000);
        recordRequest();
        vi.spyOn(Date, "now").mockReturnValue(now);

        const state = getRateLimitState();
        expect(state.minuteTimestamps.length).toBe(0);
        expect(state.hourTimestamps.length).toBe(1);
        expect(state.dayTimestamps.length).toBe(1);
        vi.restoreAllMocks();
    });

    it("handles corrupt localStorage data gracefully", () => {
        localStorageMock.setItem("codesprint-ai-rate-limit", "not-json{{{");
        const state = getRateLimitState();
        expect(state.minuteTimestamps).toEqual([]);
        expect(state.hourTimestamps).toEqual([]);
        expect(state.dayTimestamps).toEqual([]);
    });
});
