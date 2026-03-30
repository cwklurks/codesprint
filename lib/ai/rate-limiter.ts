/**
 * Client-Side Rate Limiter
 * 3-window rate limiting: per-minute, per-hour, per-day
 */

import type { RateLimiterState, RateLimitCheckResult } from "./types";

const STORAGE_KEY = "codesprint-ai-rate-limit";

const DEFAULTS = {
    maxPerMinute: 5,
    maxPerHour: 30,
    maxPerDay: 100,
    cooldownMs: 2000,
};

function isServer(): boolean {
    return typeof window === "undefined";
}

function getNow(): number {
    return Date.now();
}

function readState(): RateLimiterState {
    if (isServer()) {
        return { minuteTimestamps: [], hourTimestamps: [], dayTimestamps: [], lastRequestMs: 0 };
    }
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
            return { minuteTimestamps: [], hourTimestamps: [], dayTimestamps: [], lastRequestMs: 0 };
        }
        const parsed = JSON.parse(stored) as RateLimiterState;
        return {
            minuteTimestamps: parsed.minuteTimestamps || [],
            hourTimestamps: parsed.hourTimestamps || [],
            dayTimestamps: parsed.dayTimestamps || [],
            lastRequestMs: parsed.lastRequestMs || 0,
        };
    } catch {
        return { minuteTimestamps: [], hourTimestamps: [], dayTimestamps: [], lastRequestMs: 0 };
    }
}

function writeState(state: RateLimiterState): void {
    if (isServer()) return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        // Storage quota exceeded or other error
    }
}

function pruneOldTimestamps(state: RateLimiterState): RateLimiterState {
    const now = getNow();
    const oneMinuteAgo = now - 60_000;
    const oneHourAgo = now - 60 * 60_000;
    const oneDayAgo = now - 24 * 60 * 60_000;

    return {
        minuteTimestamps: state.minuteTimestamps.filter((ts) => ts > oneMinuteAgo),
        hourTimestamps: state.hourTimestamps.filter((ts) => ts > oneHourAgo),
        dayTimestamps: state.dayTimestamps.filter((ts) => ts > oneDayAgo),
        lastRequestMs: state.lastRequestMs,
    };
}

/**
 * Record a request attempt (call this after a successful request)
 */
export function recordRequest(): void {
    const now = getNow();
    const state = pruneOldTimestamps(readState());

    state.minuteTimestamps.push(now);
    state.hourTimestamps.push(now);
    state.dayTimestamps.push(now);
    state.lastRequestMs = now;

    writeState(state);
}

/**
 * Check if a request is allowed under current rate limits
 */
export function checkRateLimit(
    maxPerDay: number = DEFAULTS.maxPerDay
): RateLimitCheckResult {
    const now = getNow();
    const state = pruneOldTimestamps(readState());

    // Check cooldown
    const timeSinceLastRequest = now - state.lastRequestMs;
    if (timeSinceLastRequest < DEFAULTS.cooldownMs) {
        const remainingCooldown = DEFAULTS.cooldownMs - timeSinceLastRequest;
        return {
            allowed: false,
            reason: `Slow down`,
            retryAfterMs: remainingCooldown,
        };
    }

    // Check per-minute limit
    if (state.minuteTimestamps.length >= DEFAULTS.maxPerMinute) {
        const oldestMinute = state.minuteTimestamps[0];
        const retryAfterMs = oldestMinute + 60_000 - now;
        return {
            allowed: false,
            reason: `Wait ${Math.ceil(retryAfterMs / 1000)} seconds`,
            retryAfterMs: Math.max(retryAfterMs, 0),
        };
    }

    // Check per-hour limit
    if (state.hourTimestamps.length >= DEFAULTS.maxPerHour) {
        const oldestHour = state.hourTimestamps[0];
        const retryAfterMs = oldestHour + 60 * 60_000 - now;
        return {
            allowed: false,
            reason: `Wait ${Math.ceil(retryAfterMs / 60_000)} minutes`,
            retryAfterMs: Math.max(retryAfterMs, 0),
        };
    }

    // Check per-day limit
    if (state.dayTimestamps.length >= maxPerDay) {
        const oldestDay = state.dayTimestamps[0];
        const retryAfterMs = oldestDay + 24 * 60 * 60_000 - now;
        const hoursRemaining = Math.ceil(retryAfterMs / (60 * 60_000));
        return {
            allowed: false,
            reason: `Daily limit reached (0 remaining). Try again in ${hoursRemaining} hours.`,
            retryAfterMs: Math.max(retryAfterMs, 0),
        };
    }

    return { allowed: true };
}

/**
 * Get the remaining quota for today
 */
export function getRemainingToday(maxPerDay: number = DEFAULTS.maxPerDay): number {
    const state = pruneOldTimestamps(readState());
    return Math.max(0, maxPerDay - state.dayTimestamps.length);
}

/**
 * Reset all rate limit state (useful for testing)
 */
export function resetRateLimit(): void {
    if (isServer()) return;
    localStorage.removeItem(STORAGE_KEY);
}

/**
 * Get current rate limit state (for debugging)
 */
export function getRateLimitState(): RateLimiterState {
    return pruneOldTimestamps(readState());
}
