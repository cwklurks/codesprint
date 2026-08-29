import { describe, it, expect, beforeEach, vi } from "vitest";

// Controllable IndexedDB: the mirror's shape depends on whether the IDB write
// actually landed, so the tests need to drive both outcomes.
const idb = vi.hoisted(() => ({ available: true, putFails: false }));

vi.mock("../idb-store", () => ({
    STORES: {
        sessions: "sessions",
        mastery: "mastery",
        achievements: "achievements",
        customSnippets: "custom-snippets",
        meta: "meta",
        skillModels: "skill-models",
    },
    isIdbAvailable: vi.fn(async () => idb.available),
    idbPut: vi.fn(async () => {
        if (idb.putFails) throw new Error("IDB write failed");
    }),
    idbGet: vi.fn(async () => undefined),
    idbGetAll: vi.fn(async () => []),
    idbDelete: vi.fn(async () => {}),
    idbClear: vi.fn(async () => {}),
}));

import {
    createSession,
    createSessionAsync,
    getSession,
    getSessions,
    updateSession,
    deleteSession,
    clearSessions,
    getSessionStats,
    getRecentSessions,
    getSessionsBySnippet,
    SESSION_SAVED_EVENT,
    type SessionRecord,
    type CreateSessionInput,
} from "../session-history";

const mockLocalStorage = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: vi.fn((key: string) => store[key] ?? null),
        setItem: vi.fn((key: string, value: string) => {
            store[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
            delete store[key];
        }),
        clear: vi.fn(() => {
            store = {};
        }),
        get length() {
            return Object.keys(store).length;
        },
        key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    };
})();

const dispatchEvent = vi.fn((event: Event) => Boolean(event));

vi.stubGlobal("window", {
    localStorage: mockLocalStorage,
    dispatchEvent,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
});

let uuidCounter = 0;
vi.stubGlobal("crypto", { randomUUID: vi.fn(() => `test-uuid-${++uuidCounter}`) });

function createMockInput(overrides: Partial<CreateSessionInput> = {}): CreateSessionInput {
    return {
        snippetId: "test-snippet",
        language: "javascript",
        lengthCategory: "medium",
        difficulty: "easy",
        wpm: 60,
        rawWpm: 65,
        accuracy: 0.95,
        elapsedMs: 30000,
        totalKeystrokes: 300,
        correctKeystrokes: 285,
        errorCount: 5,
        history: [
            { time: 1, wpm: 55, raw: 60, errors: 1, burst: 70 },
            { time: 2, wpm: 58, raw: 63, errors: 2, burst: 65 },
        ],
        ...overrides,
    };
}

describe("session-history", () => {
    beforeEach(() => {
        mockLocalStorage.clear();
        uuidCounter = 0;
        idb.available = true;
        idb.putFails = false;
        vi.clearAllMocks();
    });

    describe("createSession", () => {
        it("should create a session with generated id and date", () => {
            const input = createMockInput();
            const result = createSession(input);

            expect(result).not.toBeNull();
            expect(result?.id).toMatch(/^test-uuid-/);
            expect(result?.date).toBeDefined();
            expect(result?.snippetId).toBe(input.snippetId);
            expect(result?.wpm).toBe(input.wpm);
        });

        it("should store the session in localStorage", () => {
            const input = createMockInput();
            createSession(input);

            expect(mockLocalStorage.setItem).toHaveBeenCalled();
            const stored = JSON.parse(mockLocalStorage.setItem.mock.calls[0][1]);
            expect(stored).toHaveLength(1);
            expect(stored[0].snippetId).toBe(input.snippetId);
        });

        it("should prepend new sessions (most recent first)", () => {
            createSession(createMockInput({ snippetId: "first" }));
            createSession(createMockInput({ snippetId: "second" }));

            const sessions = getSessions();
            expect(sessions[0].snippetId).toBe("second");
            expect(sessions[1].snippetId).toBe("first");
        });
    });

    describe("session-saved announcement", () => {
        // Read-only surfaces (the hero's personal-best line) mount once and would
        // otherwise stay stale for the rest of the page's life.
        it("announces a synchronous write on window", () => {
            const record = createSession(createMockInput({ wpm: 88 }));

            expect(dispatchEvent).toHaveBeenCalledTimes(1);
            const event = dispatchEvent.mock.calls[0][0] as unknown as CustomEvent;
            expect(event.type).toBe(SESSION_SAVED_EVENT);
            expect(event.detail).toEqual({ id: record!.id, wpm: 88 });
        });

        it("announces an async write once the record has been persisted", async () => {
            await createSessionAsync(createMockInput({ wpm: 42 }));

            expect(dispatchEvent).toHaveBeenCalledTimes(1);
            const event = dispatchEvent.mock.calls[0][0] as unknown as CustomEvent;
            expect(event.type).toBe(SESSION_SAVED_EVENT);
            expect((event.detail as { wpm: number }).wpm).toBe(42);
        });

        it("stays quiet when nothing was written", () => {
            updateSession("missing-id", { wpm: 10 });
            expect(dispatchEvent).not.toHaveBeenCalled();
        });
    });

    describe("localStorage mirror", () => {
        function storedRecords() {
            return JSON.parse(mockLocalStorage.getItem("codesprint-session-history")!);
        }

        it("drops the per-second history samples once IndexedDB has the record", async () => {
            await createSessionAsync(createMockInput());

            expect(storedRecords()[0].history).toEqual([]);
        });

        it("keeps the full record when IndexedDB is unavailable (the mirror IS the store)", async () => {
            idb.available = false;
            const input = createMockInput();

            await createSessionAsync(input);

            expect(storedRecords()[0].history).toEqual(input.history);
        });

        it("keeps the full record when the IndexedDB write fails", async () => {
            idb.putFails = true;
            const input = createMockInput();

            await createSessionAsync(input);

            expect(storedRecords()[0].history).toEqual(input.history);
        });

        it("keeps the full record on the sync path, where the IDB write is unconfirmed", () => {
            const input = createMockInput();

            createSession(input);

            expect(storedRecords()[0].history).toEqual(input.history);
        });

        it("keeps errors and snippetContent, which weak-pattern analysis reads synchronously", () => {
            createSession(
                createMockInput({
                    errors: [{ expected: "a", got: "b", index: 3 }],
                    snippetContent: "const a = 1;",
                    snippetContentLength: 12,
                }),
            );

            const stored = JSON.parse(mockLocalStorage.getItem("codesprint-session-history")!);
            expect(stored[0].errors).toEqual([{ expected: "a", got: "b", index: 3 }]);
            expect(stored[0].snippetContent).toBe("const a = 1;");
        });

        it("trims the oldest half and retries once when the quota is exceeded", () => {
            for (let i = 0; i < 8; i++) createSession(createMockInput({ wpm: i }));

            const quotaError = new DOMException("quota", "QuotaExceededError");
            let thrown = false;
            mockLocalStorage.setItem.mockImplementationOnce(() => {
                thrown = true;
                throw quotaError;
            });

            expect(() => createSession(createMockInput({ wpm: 99 }))).not.toThrow();
            expect(thrown).toBe(true);

            // The retry kept the newest half rather than losing the write entirely.
            const stored = JSON.parse(mockLocalStorage.getItem("codesprint-session-history")!);
            expect(stored).toHaveLength(4);
            expect(stored[0].wpm).toBe(99);
        });

    });

    // The warn-once latch is module state, so each of these needs a fresh module.
    describe("mirror warnings", () => {
        async function freshModule() {
            vi.resetModules();
            return import("../session-history");
        }

        it("does not claim IndexedDB has the full history when it does not", async () => {
            idb.available = false;
            const { createSessionAsync: create } = await freshModule();
            const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
            mockLocalStorage.setItem.mockImplementationOnce(() => {
                throw new DOMException("quota", "QuotaExceededError");
            });

            await create(createMockInput());

            const message = warn.mock.calls.map((call) => String(call[0])).join("\n");
            expect(message).toContain("exceeded the localStorage quota");
            expect(message).not.toContain("IndexedDB still holds the full history");
            warn.mockRestore();
        });

        it("still warns about a quota trim after an unrelated mirror warning", async () => {
            const { createSessionAsync: create } = await freshModule();
            const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

            // A non-quota failure warns first...
            mockLocalStorage.setItem.mockImplementationOnce(() => {
                throw new Error("localStorage is disabled");
            });
            await create(createMockInput());

            // ...and must not silence the later data-loss warning.
            mockLocalStorage.setItem.mockImplementationOnce(() => {
                throw new DOMException("quota", "QuotaExceededError");
            });
            await create(createMockInput());

            const message = warn.mock.calls.map((call) => String(call[0])).join("\n");
            expect(message).toContain("Failed to mirror session history");
            expect(message).toContain("exceeded the localStorage quota");
            warn.mockRestore();
        });
    });

    describe("getSession", () => {
        it("should retrieve a session by id", () => {
            const created = createSession(createMockInput());
            const retrieved = getSession(created!.id);

            expect(retrieved).not.toBeNull();
            expect(retrieved?.id).toBe(created?.id);
        });

        it("should return null for non-existent id", () => {
            createSession(createMockInput());
            const result = getSession("non-existent-id");

            expect(result).toBeNull();
        });
    });

    describe("getSessions", () => {
        it("should return all sessions when no filters provided", () => {
            createSession(createMockInput({ language: "javascript" }));
            createSession(createMockInput({ language: "python" }));

            const sessions = getSessions();
            expect(sessions).toHaveLength(2);
        });

        it("should filter by language", () => {
            createSession(createMockInput({ language: "javascript" }));
            createSession(createMockInput({ language: "python" }));
            createSession(createMockInput({ language: "javascript" }));

            const sessions = getSessions({ language: "javascript" });
            expect(sessions).toHaveLength(2);
            expect(sessions.every((s) => s.language === "javascript")).toBe(true);
        });

        it("should filter by lengthCategory", () => {
            createSession(createMockInput({ lengthCategory: "short" }));
            createSession(createMockInput({ lengthCategory: "medium" }));
            createSession(createMockInput({ lengthCategory: "short" }));

            const sessions = getSessions({ lengthCategory: "short" });
            expect(sessions).toHaveLength(2);
        });

        it("should filter by difficulty", () => {
            createSession(createMockInput({ difficulty: "easy" }));
            createSession(createMockInput({ difficulty: "hard" }));

            const sessions = getSessions({ difficulty: "hard" });
            expect(sessions).toHaveLength(1);
        });

        it("should filter by snippetId", () => {
            createSession(createMockInput({ snippetId: "snippet-a" }));
            createSession(createMockInput({ snippetId: "snippet-b" }));
            createSession(createMockInput({ snippetId: "snippet-a" }));

            const sessions = getSessions({ snippetId: "snippet-a" });
            expect(sessions).toHaveLength(2);
        });

        it("should apply limit and offset", () => {
            for (let i = 0; i < 5; i++) {
                createSession(createMockInput({ wpm: i * 10 }));
            }

            const sessions = getSessions({ limit: 2, offset: 1 });
            expect(sessions).toHaveLength(2);
            expect(sessions[0].wpm).toBe(30); // Most recent is wpm=40, offset=1 gives wpm=30
            expect(sessions[1].wpm).toBe(20);
        });

        it("should combine multiple filters", () => {
            createSession(createMockInput({ language: "javascript", difficulty: "easy" }));
            createSession(createMockInput({ language: "javascript", difficulty: "hard" }));
            createSession(createMockInput({ language: "python", difficulty: "easy" }));

            const sessions = getSessions({ language: "javascript", difficulty: "easy" });
            expect(sessions).toHaveLength(1);
        });
    });

    describe("updateSession", () => {
        it("should update an existing session", () => {
            const created = createSession(createMockInput({ wpm: 60 }));
            const updated = updateSession(created!.id, { wpm: 70 });

            expect(updated).not.toBeNull();
            expect(updated?.wpm).toBe(70);
            expect(updated?.id).toBe(created?.id);
            expect(updated?.date).toBe(created?.date);
        });

        it("should return null for non-existent id", () => {
            createSession(createMockInput());
            const result = updateSession("non-existent-id", { wpm: 100 });

            expect(result).toBeNull();
        });

        it("should not allow updating id or date", () => {
            const created = createSession(createMockInput());
            // TypeScript prevents this at compile time, but we test runtime behavior
            const updated = updateSession(created!.id, { wpm: 100 } as Partial<SessionRecord>);

            expect(updated?.id).toBe(created?.id);
            expect(updated?.date).toBe(created?.date);
        });

        it("should persist the update to storage", () => {
            const created = createSession(createMockInput({ wpm: 60 }));
            updateSession(created!.id, { wpm: 70 });

            const retrieved = getSession(created!.id);
            expect(retrieved?.wpm).toBe(70);
        });
    });

    describe("deleteSession", () => {
        it("should delete an existing session", () => {
            const created = createSession(createMockInput());
            const result = deleteSession(created!.id);

            expect(result).toBe(true);
            expect(getSession(created!.id)).toBeNull();
        });

        it("should return false for non-existent id", () => {
            createSession(createMockInput());
            const result = deleteSession("non-existent-id");

            expect(result).toBe(false);
        });

        it("should not affect other sessions", () => {
            const session1 = createSession(createMockInput({ snippetId: "keep" }));
            const session2 = createSession(createMockInput({ snippetId: "delete" }));

            deleteSession(session2!.id);

            expect(getSession(session1!.id)).not.toBeNull();
            expect(getSessions()).toHaveLength(1);
        });
    });

    describe("clearSessions", () => {
        it("should remove all sessions", () => {
            createSession(createMockInput());
            createSession(createMockInput());
            createSession(createMockInput());

            clearSessions();

            expect(getSessions()).toHaveLength(0);
            expect(mockLocalStorage.removeItem).toHaveBeenCalled();
        });
    });

    describe("getSessionStats", () => {
        it("should return zero stats for empty history", () => {
            const stats = getSessionStats();

            expect(stats.totalSessions).toBe(0);
            expect(stats.averageWpm).toBe(0);
            expect(stats.averageAccuracy).toBe(0);
            expect(stats.bestWpm).toBe(0);
            expect(stats.totalTimeMs).toBe(0);
        });

        it("should calculate correct statistics", () => {
            createSession(createMockInput({ wpm: 60, accuracy: 0.9, elapsedMs: 30000 }));
            createSession(createMockInput({ wpm: 80, accuracy: 0.95, elapsedMs: 25000 }));
            createSession(createMockInput({ wpm: 70, accuracy: 0.92, elapsedMs: 28000 }));

            const stats = getSessionStats();

            expect(stats.totalSessions).toBe(3);
            expect(stats.averageWpm).toBe(70); // (60 + 80 + 70) / 3
            expect(stats.averageAccuracy).toBeCloseTo(0.923, 2); // (0.9 + 0.95 + 0.92) / 3
            expect(stats.bestWpm).toBe(80);
            expect(stats.totalTimeMs).toBe(83000);
        });

        it("should respect filters", () => {
            createSession(createMockInput({ language: "javascript", wpm: 60 }));
            createSession(createMockInput({ language: "python", wpm: 100 }));

            const stats = getSessionStats({ language: "javascript" });

            expect(stats.totalSessions).toBe(1);
            expect(stats.averageWpm).toBe(60);
            expect(stats.bestWpm).toBe(60);
        });
    });

    describe("getRecentSessions", () => {
        it("should return the most recent sessions", () => {
            for (let i = 0; i < 15; i++) {
                createSession(createMockInput({ wpm: i }));
            }

            const recent = getRecentSessions(5);

            expect(recent).toHaveLength(5);
            expect(recent[0].wpm).toBe(14); // Most recent
            expect(recent[4].wpm).toBe(10);
        });

        it("should use default count of 10", () => {
            for (let i = 0; i < 15; i++) {
                createSession(createMockInput());
            }

            const recent = getRecentSessions();
            expect(recent).toHaveLength(10);
        });
    });

    describe("getSessionsBySnippet", () => {
        it("should return all sessions for a specific snippet", () => {
            createSession(createMockInput({ snippetId: "target" }));
            createSession(createMockInput({ snippetId: "other" }));
            createSession(createMockInput({ snippetId: "target" }));

            const sessions = getSessionsBySnippet("target");

            expect(sessions).toHaveLength(2);
            expect(sessions.every((s) => s.snippetId === "target")).toBe(true);
        });
    });
});
