import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { Snippet } from "@/lib/snippets";

// Mock the preferences module - usePreferences returns { preferences, setTheme, ... }
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
        setTheme: vi.fn(),
        setFontSize: vi.fn(),
        setCaretWidth: vi.fn(),
        setCountdownEnabled: vi.fn(),
        setSurfaceStyle: vi.fn(),
        setShowLiveStatsDuringRun: vi.fn(),
        setInterfaceMode: vi.fn(),
        setRequireTabForIndent: vi.fn(),
        setSyntaxHighlighting: vi.fn(),
        setVimMode: vi.fn(),
        setDebugGapBuffer: vi.fn(),
    }),
}));

// Must import AFTER vi.mock so the mock is in place
import { useTypingEngine } from "../useTypingEngine";

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

function fireKey(key: string, opts: Partial<KeyboardEventInit> = {}): KeyboardEvent {
    return new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
        ...opts,
    });
}

describe("useTypingEngine", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // -------------------------------------------------------------------------
    // Initial state
    // -------------------------------------------------------------------------

    it("starts in idle phase", () => {
        const snippet = makeSnippet("hello");
        const { result } = renderHook(() => useTypingEngine({ snippet }));
        expect(result.current.phase).toBe("idle");
    });

    it("starts with cursorIndex 0", () => {
        const snippet = makeSnippet("hello");
        const { result } = renderHook(() => useTypingEngine({ snippet }));
        expect(result.current.cursorIndex).toBe(0);
    });

    it("starts with empty wrongChars set", () => {
        const snippet = makeSnippet("hello");
        const { result } = renderHook(() => useTypingEngine({ snippet }));
        expect(result.current.wrongChars.size).toBe(0);
    });

    it("starts with empty errorLog", () => {
        const snippet = makeSnippet("hello");
        const { result } = renderHook(() => useTypingEngine({ snippet }));
        expect(result.current.errorLog).toEqual([]);
    });

    // -------------------------------------------------------------------------
    // Phase transition: idle -> running on first keystroke
    // -------------------------------------------------------------------------

    it("transitions from idle to running on first keystroke", () => {
        const snippet = makeSnippet("hello");
        const { result } = renderHook(() => useTypingEngine({ snippet }));

        act(() => {
            result.current.handleKeyDown(fireKey("h"));
        });

        expect(result.current.phase).toBe("running");
    });

    it("does not transition on modifier-only keys", () => {
        const snippet = makeSnippet("hello");
        const { result } = renderHook(() => useTypingEngine({ snippet }));

        act(() => {
            result.current.handleKeyDown(fireKey("Meta"));
            result.current.handleKeyDown(fireKey("Alt"));
            result.current.handleKeyDown(fireKey("Control"));
        });

        expect(result.current.phase).toBe("idle");
    });

    // -------------------------------------------------------------------------
    // Correct keystroke advances cursor
    // -------------------------------------------------------------------------

    it("advances cursor index on a correct keystroke", () => {
        const snippet = makeSnippet("hello");
        const { result } = renderHook(() => useTypingEngine({ snippet }));

        act(() => {
            result.current.handleKeyDown(fireKey("h"));
        });

        expect(result.current.cursorIndex).toBe(1);
    });

    it("advances cursor through multiple correct keystrokes", () => {
        const snippet = makeSnippet("hi");
        const { result } = renderHook(() => useTypingEngine({ snippet }));

        act(() => {
            result.current.handleKeyDown(fireKey("h"));
            result.current.handleKeyDown(fireKey("i"));
        });

        expect(result.current.cursorIndex).toBe(2);
    });

    it("correctly matches characters when keystrokes batch in one act (rapid typing)", () => {
        const snippet = makeSnippet("hello\n");
        const { result } = renderHook(() => useTypingEngine({ snippet }));

        // All keystrokes in a single act() — simulates rapid typing before React effects run
        act(() => {
            result.current.handleKeyDown(fireKey("h"));
            result.current.handleKeyDown(fireKey("e"));
            result.current.handleKeyDown(fireKey("l"));
            result.current.handleKeyDown(fireKey("l"));
            result.current.handleKeyDown(fireKey("o"));
        });

        expect(result.current.cursorIndex).toBe(5);
        expect(result.current.wrongChars.size).toBe(0);
    });

    it("does not add to wrongChars on correct keystroke", () => {
        const snippet = makeSnippet("hello");
        const { result } = renderHook(() => useTypingEngine({ snippet }));

        act(() => {
            result.current.handleKeyDown(fireKey("h"));
        });

        expect(result.current.wrongChars.size).toBe(0);
    });

    // -------------------------------------------------------------------------
    // Incorrect keystroke marks wrong character
    // -------------------------------------------------------------------------

    it("marks a character as wrong on incorrect keystroke", () => {
        const snippet = makeSnippet("hello");
        const { result } = renderHook(() => useTypingEngine({ snippet }));

        act(() => {
            result.current.handleKeyDown(fireKey("x")); // wrong: expected 'h'
        });

        // wrongChars is published on the 100ms tick, advance timers to trigger it
        act(() => { vi.advanceTimersByTime(100); });

        expect(result.current.wrongChars.has(0)).toBe(true);
    });

    it("advances cursor even on incorrect keystroke", () => {
        const snippet = makeSnippet("hello");
        const { result } = renderHook(() => useTypingEngine({ snippet }));

        act(() => {
            result.current.handleKeyDown(fireKey("x")); // wrong: expected 'h'
        });

        expect(result.current.cursorIndex).toBe(1);
    });

    it("logs an error entry on incorrect keystroke", () => {
        const snippet = makeSnippet("hello");
        const { result } = renderHook(() => useTypingEngine({ snippet }));

        act(() => {
            result.current.handleKeyDown(fireKey("x")); // wrong: expected 'h'
        });

        expect(result.current.errorLog).toHaveLength(1);
        expect(result.current.errorLog[0]).toMatchObject({
            expected: "h",
            got: "x",
            index: 0,
        });
    });

    // -------------------------------------------------------------------------
    // Backspace
    // -------------------------------------------------------------------------

    it("handles backspace by moving cursor back one position", () => {
        const snippet = makeSnippet("hello");
        const { result } = renderHook(() => useTypingEngine({ snippet }));

        act(() => {
            result.current.handleKeyDown(fireKey("h")); // cursor -> 1
        });
        act(() => {
            result.current.handleKeyDown(fireKey("Backspace")); // cursor -> 0
        });

        expect(result.current.cursorIndex).toBe(0);
    });

    it("backspace removes the character from wrongChars", () => {
        const snippet = makeSnippet("hello");
        const { result } = renderHook(() => useTypingEngine({ snippet }));

        act(() => {
            result.current.handleKeyDown(fireKey("x")); // wrong at index 0, cursor -> 1
        });
        act(() => {
            result.current.handleKeyDown(fireKey("Backspace")); // cursor back to 0, clear wrong[0]
        });

        expect(result.current.wrongChars.has(0)).toBe(false);
    });

    it("backspace does nothing when cursor is at index 0", () => {
        const snippet = makeSnippet("hello");
        const { result } = renderHook(() => useTypingEngine({ snippet }));

        act(() => {
            result.current.handleKeyDown(fireKey("Backspace"));
        });

        // Cursor stays at 0 and phase stays idle (Backspace doesn't start a session)
        expect(result.current.cursorIndex).toBe(0);
    });

    // -------------------------------------------------------------------------
    // Finish when all characters are typed
    // -------------------------------------------------------------------------

    it("transitions to finished phase when all characters are typed correctly", () => {
        const snippet = makeSnippet("ab");
        const onFinish = vi.fn();
        const { result } = renderHook(() =>
            useTypingEngine({ snippet, onFinish })
        );

        act(() => {
            result.current.handleKeyDown(fireKey("a"));
        });
        act(() => {
            result.current.handleKeyDown(fireKey("b"));
        });

        expect(result.current.phase).toBe("finished");
    });

    it("calls onFinish callback when session completes", () => {
        const snippet = makeSnippet("ab");
        const onFinish = vi.fn();
        const { result } = renderHook(() =>
            useTypingEngine({ snippet, onFinish })
        );

        act(() => {
            result.current.handleKeyDown(fireKey("a"));
        });
        act(() => {
            result.current.handleKeyDown(fireKey("b"));
        });

        expect(onFinish).toHaveBeenCalledTimes(1);
    });

    it("transitions to finished phase when the last character is typed incorrectly", () => {
        const snippet = makeSnippet("ab");
        const onFinish = vi.fn();
        const { result } = renderHook(() =>
            useTypingEngine({ snippet, onFinish })
        );

        act(() => {
            result.current.handleKeyDown(fireKey("a"));
        });
        act(() => {
            result.current.handleKeyDown(fireKey("x"));
        });

        expect(result.current.phase).toBe("finished");
        expect(result.current.wrongChars.has(1)).toBe(true);
        expect(onFinish).toHaveBeenCalledTimes(1);
    });

    // -------------------------------------------------------------------------
    // Enter treated as newline
    // -------------------------------------------------------------------------

    it("treats Enter key as a newline character", () => {
        const snippet = makeSnippet("a\nb");
        const { result } = renderHook(() => useTypingEngine({ snippet }));

        act(() => {
            result.current.handleKeyDown(fireKey("a"));
        });
        act(() => {
            result.current.handleKeyDown(fireKey("Enter"));
        });

        expect(result.current.cursorIndex).toBe(2);
        expect(result.current.wrongChars.size).toBe(0);
    });

    it("marks Enter as wrong when snippet expects a different character", () => {
        const snippet = makeSnippet("ab");
        const { result } = renderHook(() => useTypingEngine({ snippet }));

        act(() => {
            result.current.handleKeyDown(fireKey("a"));
        });
        act(() => {
            result.current.handleKeyDown(fireKey("Enter"));
        });

        expect(result.current.wrongChars.has(1)).toBe(true);
    });

    // -------------------------------------------------------------------------
    // Modifier keys ignored
    // -------------------------------------------------------------------------

    it("ignores Meta key entirely (no state change)", () => {
        const snippet = makeSnippet("hello");
        const { result } = renderHook(() => useTypingEngine({ snippet }));

        act(() => {
            result.current.handleKeyDown(fireKey("Meta"));
        });

        expect(result.current.phase).toBe("idle");
        expect(result.current.cursorIndex).toBe(0);
    });

    it("ignores Alt key entirely (no state change)", () => {
        const snippet = makeSnippet("hello");
        const { result } = renderHook(() => useTypingEngine({ snippet }));

        act(() => {
            result.current.handleKeyDown(fireKey("Alt"));
        });

        expect(result.current.phase).toBe("idle");
        expect(result.current.cursorIndex).toBe(0);
    });

    it("ignores Control key entirely (no state change)", () => {
        const snippet = makeSnippet("hello");
        const { result } = renderHook(() => useTypingEngine({ snippet }));

        act(() => {
            result.current.handleKeyDown(fireKey("Control"));
        });

        expect(result.current.phase).toBe("idle");
        expect(result.current.cursorIndex).toBe(0);
    });

    // -------------------------------------------------------------------------
    // Reset
    // -------------------------------------------------------------------------

    it("resets all state back to initial values", () => {
        const snippet = makeSnippet("hello");
        const { result } = renderHook(() => useTypingEngine({ snippet }));

        act(() => {
            result.current.handleKeyDown(fireKey("h"));
            result.current.handleKeyDown(fireKey("x")); // wrong at index 1
        });

        // Confirm state changed before reset
        expect(result.current.cursorIndex).toBeGreaterThan(0);

        act(() => {
            result.current.reset();
        });

        expect(result.current.phase).toBe("idle");
        expect(result.current.cursorIndex).toBe(0);
        expect(result.current.wrongChars.size).toBe(0);
        expect(result.current.errorLog).toEqual([]);
        expect(result.current.elapsedMs).toBe(0);
        expect(result.current.history).toEqual([]);
    });

    // -------------------------------------------------------------------------
    // start() helper
    // -------------------------------------------------------------------------

    it("start() transitions idle -> running when countdownEnabled is false", () => {
        const snippet = makeSnippet("hello");
        const { result } = renderHook(() => useTypingEngine({ snippet }));

        act(() => {
            result.current.start();
        });

        expect(result.current.phase).toBe("running");
    });

    // -------------------------------------------------------------------------
    // Return shape
    // -------------------------------------------------------------------------

    it("wrongChars is accurate after rapid mixed correct/incorrect keystrokes", () => {
        const snippet = makeSnippet("abcdef\n");
        const { result } = renderHook(() => useTypingEngine({ snippet }));

        act(() => {
            result.current.handleKeyDown(fireKey("a")); // correct
            result.current.handleKeyDown(fireKey("x")); // wrong at 1
            result.current.handleKeyDown(fireKey("c")); // correct
            result.current.handleKeyDown(fireKey("x")); // wrong at 3
            result.current.handleKeyDown(fireKey("e")); // correct
            result.current.handleKeyDown(fireKey("f")); // correct
        });

        // Advance timer to publish wrongChars snapshot
        act(() => { vi.advanceTimersByTime(100); });

        expect(result.current.cursorIndex).toBe(6);
        expect(result.current.wrongChars.has(1)).toBe(true);
        expect(result.current.wrongChars.has(3)).toBe(true);
        expect(result.current.wrongChars.has(0)).toBe(false);
        expect(result.current.wrongChars.has(2)).toBe(false);
        expect(result.current.wrongChars.size).toBe(2);
    });

    it("wrongChars clears correctly after backspace through errors", () => {
        const snippet = makeSnippet("abc\n");
        const { result } = renderHook(() => useTypingEngine({ snippet }));

        act(() => {
            result.current.handleKeyDown(fireKey("x")); // wrong at 0
            result.current.handleKeyDown(fireKey("x")); // wrong at 1
        });

        // Advance timer to publish wrongChars snapshot
        act(() => { vi.advanceTimersByTime(100); });

        expect(result.current.wrongChars.size).toBe(2);

        act(() => {
            result.current.handleKeyDown(fireKey("Backspace")); // back to 1, clear 1
            result.current.handleKeyDown(fireKey("Backspace")); // back to 0, clear 0
        });

        act(() => { vi.advanceTimersByTime(100); });

        expect(result.current.wrongChars.size).toBe(0);
    });

    it("exposes the expected return properties", () => {
        const snippet = makeSnippet("hello");
        const { result } = renderHook(() => useTypingEngine({ snippet }));
        const keys = Object.keys(result.current);

        expect(keys).toContain("phase");
        expect(keys).toContain("countdown");
        expect(keys).toContain("cursorIndex");
        expect(keys).toContain("wrongChars");
        expect(keys).toContain("metrics");
        expect(keys).toContain("elapsedMs");
        expect(keys).toContain("errorLog");
        expect(keys).toContain("caretErrorActive");
        expect(keys).toContain("history");
        expect(keys).toContain("reset");
        expect(keys).toContain("start");
        expect(keys).toContain("handleKeyDown");
        expect(keys).toContain("setPhase");
    });
});
