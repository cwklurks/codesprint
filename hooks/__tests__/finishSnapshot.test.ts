import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { Snippet } from "@/lib/snippets";

vi.mock("@/lib/preferences", () => ({
    usePreferences: () => ({
        preferences: {
            countdownEnabled: false,
            vimMode: false,
            requireTabForIndent: false,
            theme: "gruvbox",
            fontSize: 24,
            caretWidth: 3,
            surfaceStyle: "immersive",
            showLiveStatsDuringRun: true,
            interfaceMode: "ide",
            syntaxHighlighting: "full",
            debugGapBuffer: false,
        },
    }),
}));

vi.mock("@/lib/leaderboard", () => ({ saveScore: vi.fn() }));

vi.mock("@/lib/storage/session-history", () => ({
    createSessionAsync: vi.fn().mockResolvedValue(undefined),
    getSessionStatsAsync: vi.fn().mockResolvedValue({
        totalSessions: 0,
        averageWpm: 0,
        averageAccuracy: 0,
        bestWpm: 0,
        totalTimeMs: 0,
    }),
}));

import { useTypingEngine } from "../useTypingEngine";
import { useSessionLifecycle } from "../useSessionLifecycle";
import { createSessionAsync } from "@/lib/storage/session-history";

const mockCreateSessionAsync = vi.mocked(createSessionAsync);

const SNIPPET_TEXT = "const a = 1;";

function makeSnippet(content: string): Snippet {
    return {
        id: "test",
        problemId: "test:test",
        title: "Test Snippet",
        content,
        language: "javascript" as const,
        lengthCategory: "short" as const,
        difficulty: "easy" as const,
        lines: content.split("\n").length,
    };
}

function fireKey(key: string): KeyboardEvent {
    return new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
}

/** Wires the engine to the lifecycle exactly the way TypingSession does. */
function useSessionHarness(snippet: Snippet) {
    const engine = useTypingEngine({ snippet });
    const final = engine.finalSnapshot;

    const metrics = final ? final.metrics : engine.metrics;
    const elapsedMs = final ? final.elapsedMs : engine.elapsedMs;
    const errorCount = final ? final.wrongChars.size : engine.wrongChars.size;
    const history = final ? final.history : engine.history;
    const totalKeystrokes = final ? final.totalKeystrokes : engine.totalKeystrokes;
    const correctKeystrokes = final ? final.correctKeystrokes : engine.correctKeystrokes;

    useSessionLifecycle({
        phase: engine.phase,
        snippetId: snippet.id,
        metrics,
        language: "javascript",
        elapsedMs,
        totalKeystrokes,
        correctKeystrokes,
        errorCount,
        history,
        lengthCategory: snippet.lengthCategory,
        difficulty: snippet.difficulty,
        errors: final ? final.errorLog : engine.errorLog,
        snippetContent: snippet.content,
        onResetEngine: engine.reset,
    });

    return engine;
}

describe("final session snapshot", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("captures the exact elapsed time at the finishing keystroke", () => {
        const snippet = makeSnippet("ab");
        const { result } = renderHook(() => useTypingEngine({ snippet }));

        const startedAt = Date.parse("2026-01-01T00:00:00.000Z");
        act(() => {
            result.current.handleKeyDown(fireKey("a"));
        });

        // Finish 12,345 ms later — a value no 100 ms / 200 ms / 1 s tick lands on.
        vi.setSystemTime(new Date(startedAt + 12345));
        act(() => {
            result.current.handleKeyDown(fireKey("b"));
        });

        expect(result.current.phase).toBe("finished");
        expect(result.current.finalSnapshot).not.toBeNull();
        expect(result.current.finalSnapshot!.elapsedMs).toBe(12345);
        expect(result.current.elapsedMs).toBe(12345);
    });

    it("publishes the snapshot in the same commit that reports the finished phase", () => {
        const snippet = makeSnippet("ab");
        const { result } = renderHook(() => useTypingEngine({ snippet }));

        act(() => {
            result.current.handleKeyDown(fireKey("a"));
        });
        vi.setSystemTime(new Date(Date.now() + 5000));
        act(() => {
            result.current.handleKeyDown(fireKey("b"));
        });

        const snapshot = result.current.finalSnapshot!;
        // The published values consumers read are the snapshot's, not a later sample.
        expect(result.current.metrics).toBe(snapshot.metrics);
        expect(result.current.wrongChars).toBe(snapshot.wrongChars);
    });

    it("clears the snapshot when the run reopens or resets", () => {
        const snippet = makeSnippet("ab");
        const { result } = renderHook(() => useTypingEngine({ snippet }));

        act(() => {
            result.current.handleKeyDown(fireKey("a"));
            result.current.handleKeyDown(fireKey("b"));
        });
        expect(result.current.finalSnapshot).not.toBeNull();

        act(() => {
            result.current.handleKeyDown(fireKey("Backspace"));
        });
        expect(result.current.phase).toBe("running");
        expect(result.current.finalSnapshot).toBeNull();

        act(() => {
            result.current.reset();
        });
        expect(result.current.finalSnapshot).toBeNull();
    });

    it("persists exactly the snapshot's metrics, elapsed time and error data", async () => {
        const snippet = makeSnippet(SNIPPET_TEXT);
        const { result } = renderHook(() => useSessionHarness(snippet));

        const startedAt = Date.now();
        const chars = SNIPPET_TEXT.split("");

        act(() => {
            // Type everything except the last character, with one deliberate typo.
            chars.slice(0, -1).forEach((ch, index) => {
                result.current.handleKeyDown(fireKey(index === 6 ? "z" : ch));
            });
        });

        vi.setSystemTime(new Date(startedAt + 9876));
        act(() => {
            result.current.handleKeyDown(fireKey(chars[chars.length - 1]));
        });

        const snapshot = result.current.finalSnapshot!;
        expect(snapshot.elapsedMs).toBe(9876);

        // The write lands after the prior-best read resolves; flush those microtasks.
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1);
        });
        expect(mockCreateSessionAsync).toHaveBeenCalledTimes(1);

        const persisted = mockCreateSessionAsync.mock.calls[0][0];
        expect(persisted.wpm).toBe(snapshot.metrics.adjustedWpm);
        expect(persisted.rawWpm).toBe(snapshot.metrics.rawWpm);
        expect(persisted.accuracy).toBe(snapshot.metrics.accuracy);
        expect(persisted.patternScore).toBe(snapshot.metrics.patternScore);
        expect(persisted.elapsedMs).toBe(snapshot.elapsedMs);
        expect(persisted.errorCount).toBe(snapshot.wrongChars.size);
        expect(persisted.totalKeystrokes).toBe(snapshot.totalKeystrokes);
        expect(persisted.correctKeystrokes).toBe(snapshot.correctKeystrokes);
        expect(persisted.errors).toEqual(snapshot.errorLog);
        expect(persisted.history).toEqual(snapshot.history);
        // A real typo happened, so this is not a vacuous comparison.
        expect(snapshot.wrongChars.size).toBe(1);
        expect(snapshot.metrics.accuracy).toBeLessThan(1);
    });
});
