import { describe, it, expect, vi, beforeEach } from "vitest";

const STORAGE_KEY = "codesprint-leaderboard";

// Mock localStorage for jsdom environment
const store: Record<string, string> = {};
const mockLocalStorage = {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
};

vi.stubGlobal("window", { localStorage: mockLocalStorage });

import { getLeaderboard, saveScore, clearLeaderboard } from "../leaderboard";

describe("getLeaderboard", () => {
    beforeEach(() => {
        // Clear store and mocks
        for (const key of Object.keys(store)) delete store[key];
        vi.clearAllMocks();
    });

    it("returns empty array when storage is empty", () => {
        expect(getLeaderboard()).toEqual([]);
    });

    it("returns empty array when stored value is not an array", () => {
        store[STORAGE_KEY] = JSON.stringify({ bad: "data" });
        expect(getLeaderboard()).toEqual([]);
    });

    it("returns empty array when stored value is a string", () => {
        store[STORAGE_KEY] = '"just a string"';
        expect(getLeaderboard()).toEqual([]);
    });

    it("returns empty array when stored value is invalid JSON", () => {
        store[STORAGE_KEY] = "not json at all {{{";
        expect(getLeaderboard()).toEqual([]);
    });

    it("returns entries when stored value is a valid array", () => {
        const entries = [
            { id: "1", wpm: 100, accuracy: 0.95, date: "2026-01-01", language: "python", snippetId: "py-1" },
        ];
        store[STORAGE_KEY] = JSON.stringify(entries);
        expect(getLeaderboard()).toEqual(entries);
    });

    it("respects the limit parameter", () => {
        const entries = Array.from({ length: 10 }, (_, i) => ({
            id: String(i), wpm: 100 - i, accuracy: 0.95, date: "2026-01-01", language: "python", snippetId: "py-1",
        }));
        store[STORAGE_KEY] = JSON.stringify(entries);
        expect(getLeaderboard(3)).toHaveLength(3);
    });
});
