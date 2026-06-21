import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useKeyboardShortcuts, type UseKeyboardShortcutsProps } from "../useKeyboardShortcuts";

const cleanups: Array<() => void> = [];

afterEach(() => {
    while (cleanups.length) {
        cleanups.pop()?.();
    }
    document.querySelectorAll('[data-scope="dialog"], [data-scope="drawer"]').forEach((el) => el.remove());
});

function renderShortcuts(props: Partial<UseKeyboardShortcutsProps> = {}) {
    const defaults: UseKeyboardShortcutsProps = {
        phase: "idle",
        vimMode: false,
        problemCount: 1,
        engineHandleKeyDown: vi.fn(),
        onReset: vi.fn(),
        onNextProblem: vi.fn(),
        onStartEngine: vi.fn(),
        enableEditorFocus: vi.fn(),
        focusEditor: vi.fn(),
        setVimMode: vi.fn(),
        setShowLiveStatsDuringRun: vi.fn(),
        showLiveStatsDuringRun: true,
        clearAutoAdvance: vi.fn(),
    };
    const result = renderHook(() => useKeyboardShortcuts({ ...defaults, ...props }));
    cleanups.push(result.unmount);
    return result;
}

function fireKey(key: string, opts: Partial<KeyboardEventInit> = {}): KeyboardEvent {
    return new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
        ...opts,
    });
}

function press(key: string, opts: Partial<KeyboardEventInit> = {}): KeyboardEvent {
    const event = fireKey(key, opts);
    act(() => {
        document.dispatchEvent(event);
    });
    return event;
}

function addOverlay(scope: "dialog" | "drawer" = "dialog"): HTMLElement {
    const el = document.createElement("div");
    el.setAttribute("data-scope", scope);
    el.setAttribute("data-state", "open");
    document.body.appendChild(el);
    return el;
}

describe("useKeyboardShortcuts", () => {
    it("forwards idle printable keys to the engine when no overlay is open", () => {
        const engineHandleKeyDown = vi.fn();
        renderShortcuts({ phase: "idle", engineHandleKeyDown });

        press("r");

        expect(engineHandleKeyDown).toHaveBeenCalledTimes(1);
    });

    it("ignores idle printable keys while an overlay is open", () => {
        const engineHandleKeyDown = vi.fn();
        const onReset = vi.fn();
        renderShortcuts({ phase: "idle", engineHandleKeyDown, onReset });
        addOverlay();

        press("r");

        expect(engineHandleKeyDown).not.toHaveBeenCalled();
        expect(onReset).not.toHaveBeenCalled();
    });

    it("resets and starts the engine from finished phase when no overlay is open", () => {
        const onReset = vi.fn();
        const onStartEngine = vi.fn();
        renderShortcuts({ phase: "finished", onReset, onStartEngine });

        press("r");

        expect(onReset).toHaveBeenCalledTimes(1);
        expect(onStartEngine).toHaveBeenCalledTimes(1);
    });

    it("does not reset from finished phase while an overlay is open", () => {
        const onReset = vi.fn();
        renderShortcuts({ phase: "finished", onReset });
        addOverlay();

        press("r");

        expect(onReset).not.toHaveBeenCalled();
    });

    it("does not reset on repeated r key in finished phase", () => {
        const onReset = vi.fn();
        renderShortcuts({ phase: "finished", onReset });

        press("r", { repeat: true });

        expect(onReset).not.toHaveBeenCalled();
    });

    it("loads the next problem from finished phase when no overlay is open", () => {
        const onNextProblem = vi.fn();
        renderShortcuts({ phase: "finished", problemCount: 2, onNextProblem });

        press("n");

        expect(onNextProblem).toHaveBeenCalledTimes(1);
    });

    it("does not load next problem on repeated n key in finished phase", () => {
        const onNextProblem = vi.fn();
        renderShortcuts({ phase: "finished", problemCount: 2, onNextProblem });

        press("n", { repeat: true });

        expect(onNextProblem).not.toHaveBeenCalled();
    });

    it("does not handle Escape while an overlay is open", () => {
        const onReset = vi.fn();
        const onNextProblem = vi.fn();
        renderShortcuts({ phase: "finished", problemCount: 2, onReset, onNextProblem });
        addOverlay();

        press("Escape");

        expect(onReset).not.toHaveBeenCalled();
        expect(onNextProblem).not.toHaveBeenCalled();
    });

    it("forwards repeated typing keys to the engine while running", () => {
        const engineHandleKeyDown = vi.fn();
        renderShortcuts({ phase: "running", engineHandleKeyDown });

        press("a", { repeat: true });

        expect(engineHandleKeyDown).toHaveBeenCalledTimes(1);
    });
});
