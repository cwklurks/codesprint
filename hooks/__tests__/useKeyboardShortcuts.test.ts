import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { act } from "react";

import { useKeyboardShortcuts, type UseKeyboardShortcutsProps } from "../useKeyboardShortcuts";

function makeProps(overrides: Partial<UseKeyboardShortcutsProps> = {}): UseKeyboardShortcutsProps {
    return {
        phase: "idle",
        vimMode: false,
        problemCount: 5,
        engineHandleKeyDown: vi.fn(),
        onReset: vi.fn(),
        onNextProblem: vi.fn(),
        onStartEngine: vi.fn(),
        enableEditorFocus: vi.fn(),
        focusEditor: vi.fn(),
        setVimMode: vi.fn(),
        setShowLiveStatsDuringRun: vi.fn(),
        showLiveStatsDuringRun: false,
        clearAutoAdvance: vi.fn(),
        onOpenAIDrill: vi.fn(),
        isOverlayOpen: false,
        ...overrides,
    };
}

function press(key: string, init: Partial<KeyboardEventInit> = {}): KeyboardEvent {
    const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
    act(() => {
        document.dispatchEvent(event);
    });
    return event;
}

describe("useKeyboardShortcuts", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("Shift+A opens AI drills", () => {
        it("works in the idle phase (the printable-key guard must not swallow it)", () => {
            const props = makeProps({ phase: "idle" });
            renderHook(() => useKeyboardShortcuts(props));

            const event = press("A", { shiftKey: true });

            expect(props.onOpenAIDrill).toHaveBeenCalledTimes(1);
            expect(props.engineHandleKeyDown).not.toHaveBeenCalled();
            expect(event.defaultPrevented).toBe(true);
        });

        it("works in the finished phase (the plain-'a' passthrough must not swallow it)", () => {
            const props = makeProps({ phase: "finished" });
            renderHook(() => useKeyboardShortcuts(props));

            press("A", { shiftKey: true });

            expect(props.onOpenAIDrill).toHaveBeenCalledTimes(1);
        });

        it("does not fire while a run is in progress", () => {
            const props = makeProps({ phase: "running" });
            renderHook(() => useKeyboardShortcuts(props));

            press("A", { shiftKey: true });

            expect(props.onOpenAIDrill).not.toHaveBeenCalled();
        });

        it("leaves plain 'a' alone so AppShell can open analytics", () => {
            const props = makeProps({ phase: "finished" });
            renderHook(() => useKeyboardShortcuts(props));

            const event = press("a");

            expect(props.onOpenAIDrill).not.toHaveBeenCalled();
            expect(props.engineHandleKeyDown).not.toHaveBeenCalled();
            expect(event.defaultPrevented).toBe(false);
        });
    });

    describe("idle Tab passthrough", () => {
        it("leaves Tab alone in idle so the browser can move focus (skip link)", () => {
            const props = makeProps({ phase: "idle" });
            renderHook(() => useKeyboardShortcuts(props));

            const event = press("Tab");

            expect(props.engineHandleKeyDown).not.toHaveBeenCalled();
            expect(event.defaultPrevented).toBe(false);
        });

        it("still advances to the next problem on Tab when finished", () => {
            const props = makeProps({ phase: "finished" });
            renderHook(() => useKeyboardShortcuts(props));

            const event = press("Tab");

            expect(props.onNextProblem).toHaveBeenCalledTimes(1);
            expect(event.defaultPrevented).toBe(true);
        });
    });

    describe("overlay gate", () => {
        it("does not start a run when Enter is pressed with a dialog open", () => {
            const props = makeProps({ phase: "idle", isOverlayOpen: true });
            renderHook(() => useKeyboardShortcuts(props));

            const event = press("Enter");

            expect(props.engineHandleKeyDown).not.toHaveBeenCalled();
            expect(props.enableEditorFocus).not.toHaveBeenCalled();
            expect(event.defaultPrevented).toBe(false);
        });

        it("does not reset a run when Escape is pressed with a dialog open", () => {
            const props = makeProps({ phase: "running", isOverlayOpen: true });
            renderHook(() => useKeyboardShortcuts(props));

            press("Escape");

            expect(props.onReset).not.toHaveBeenCalled();
            expect(props.clearAutoAdvance).not.toHaveBeenCalled();
        });

        it("does not intercept Shift+A while a dialog owns the keyboard", () => {
            const props = makeProps({ phase: "idle", isOverlayOpen: true });
            renderHook(() => useKeyboardShortcuts(props));

            press("A", { shiftKey: true });

            expect(props.onOpenAIDrill).not.toHaveBeenCalled();
        });

        it("resumes normal handling once the dialog closes", () => {
            const props = makeProps({ phase: "idle", isOverlayOpen: true });
            const { rerender } = renderHook(
                (p: UseKeyboardShortcutsProps) => useKeyboardShortcuts(p),
                { initialProps: props },
            );

            press("h");
            expect(props.engineHandleKeyDown).not.toHaveBeenCalled();

            rerender({ ...props, isOverlayOpen: false });
            press("h");
            expect(props.engineHandleKeyDown).toHaveBeenCalledTimes(1);
        });
    });

    describe("listener stability", () => {
        it("keeps one listener registered across prop changes", () => {
            const addSpy = vi.spyOn(document, "addEventListener");
            const removeSpy = vi.spyOn(document, "removeEventListener");

            const props = makeProps();
            const { rerender } = renderHook(
                (p: UseKeyboardShortcutsProps) => useKeyboardShortcuts(p),
                { initialProps: props },
            );

            const initialAdds = addSpy.mock.calls.filter(([type]) => type === "keydown").length;

            // Simulate what a keystroke used to do: brand-new inline callbacks each render.
            for (let i = 0; i < 5; i++) {
                rerender({ ...makeProps(), phase: "running" });
            }

            const addsAfter = addSpy.mock.calls.filter(([type]) => type === "keydown").length;
            const removesAfter = removeSpy.mock.calls.filter(([type]) => type === "keydown").length;

            expect(addsAfter).toBe(initialAdds);
            expect(removesAfter).toBe(0);

            addSpy.mockRestore();
            removeSpy.mockRestore();
        });

        it("still sees the latest props through the stable listener", () => {
            const props = makeProps({ phase: "idle" });
            const { rerender } = renderHook(
                (p: UseKeyboardShortcutsProps) => useKeyboardShortcuts(p),
                { initialProps: props },
            );

            const finishedProps = makeProps({ phase: "finished" });
            rerender(finishedProps);

            press("n");
            expect(finishedProps.onNextProblem).toHaveBeenCalledTimes(1);
        });
    });
});
