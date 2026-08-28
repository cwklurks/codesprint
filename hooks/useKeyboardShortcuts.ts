"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Phase } from "./useFocusManagement";

export interface UseKeyboardShortcutsProps {
    phase: Phase;
    vimMode: boolean;
    problemCount: number;
    engineHandleKeyDown: (e: KeyboardEvent) => void;
    onReset: () => void;
    onNextProblem: () => void;
    onStartEngine: () => void;
    enableEditorFocus: () => void;
    focusEditor: () => void;
    setVimMode: (enabled: boolean) => void;
    setShowLiveStatsDuringRun: (enabled: boolean) => void;
    showLiveStatsDuringRun: boolean;
    clearAutoAdvance: () => void;
    onOpenAIDrill?: () => void;
    /**
     * True while any dialog/drawer owns the keyboard. The capture-phase handler
     * bails entirely so keys reach the open overlay instead of the engine.
     */
    isOverlayOpen?: boolean;
}

export interface UseKeyboardShortcutsReturn {
    /** Whether Vim preview mode is active */
    isVimPreviewing: boolean;
    /** Set Vim preview mode */
    setIsVimPreviewing: (previewing: boolean) => void;
    /** Enter Vim preview mode */
    beginVimPreview: () => void;
    /** Exit Vim preview mode */
    exitVimPreview: () => void;
}

/**
 * Hook to manage global keyboard shortcuts and event listeners
 * Extracted from TypingSession.tsx keyboard handling logic
 *
 * Manages a 7-level keyboard event hierarchy:
 * 0. Overlay gate (a dialog/drawer owns the keyboard -> do nothing)
 * 1. Global Escape Handling
 * 2. Shift+A (AI drills) — before the idle typing guard AND the plain-"a" passthrough
 * 3. Idle Typing Guard (printable keys in idle bypass shortcuts → engine)
 * 4. Vim Toggle (v key, finished phase only)
 * 5. Vim Preview Mode
 * 6. Global Shortcuts (Non-Vim, finished phase only)
 * 7. Pass to Engine (Typing)
 *
 * The document listener is registered ONCE. Every changing input is read through
 * a ref written on each render, so a keystroke never tears down and re-adds the
 * listener (it used to re-register on every keypress via inline arrow props).
 */
export function useKeyboardShortcuts(props: UseKeyboardShortcutsProps): UseKeyboardShortcutsReturn {
    const {
        phase,
        vimMode,
        enableEditorFocus,
        focusEditor,
        setVimMode,
    } = props;

    const [isVimPreviewing, setIsVimPreviewing] = useState(false);
    const vimPreviewTimeoutRef = useRef<number | null>(null);

    useEffect(() => {
        const timeoutRef = vimPreviewTimeoutRef;
        return () => {
            const id = timeoutRef.current;
            if (id !== null) window.clearTimeout(id);
        };
    }, []);

    const beginVimPreview = useCallback(() => {
        if (!vimMode) {
            setVimMode(true);
        }
        setIsVimPreviewing(true);
        enableEditorFocus();
        vimPreviewTimeoutRef.current = window.setTimeout(() => focusEditor(), 40);
    }, [enableEditorFocus, vimMode, setVimMode, focusEditor]);

    const exitVimPreview = useCallback(() => {
        setIsVimPreviewing(false);
    }, []);

    // Auto-exit vim preview when running starts
    useEffect(() => {
        if (phase === "running" && isVimPreviewing) {
            setIsVimPreviewing(false);
        }
    }, [phase, isVimPreviewing]);

    // Latest-value ref: written during render so the single document listener
    // below always sees current props without being re-registered.
    const latestRef = useRef({ props, isVimPreviewing, beginVimPreview, exitVimPreview });
    latestRef.current = { props, isVimPreviewing, beginVimPreview, exitVimPreview };

    // Main keyboard event handler — registered once for the component's lifetime.
    useEffect(() => {
        function onKeyDown(e: KeyboardEvent) {
            const {
                props: {
                    phase,
                    vimMode,
                    problemCount,
                    engineHandleKeyDown,
                    onReset,
                    onNextProblem,
                    onStartEngine,
                    enableEditorFocus,
                    focusEditor,
                    setVimMode,
                    setShowLiveStatsDuringRun,
                    showLiveStatsDuringRun,
                    clearAutoAdvance,
                    onOpenAIDrill,
                    isOverlayOpen,
                },
                isVimPreviewing,
                beginVimPreview,
                exitVimPreview,
            } = latestRef.current;

            // 0. Overlay gate: while a dialog/drawer is open it owns the keyboard.
            // Without this, the idle typing guard below turns a dialog's Enter into
            // "start a run", and Escape resets the session instead of closing it.
            if (isOverlayOpen) return;

            const allowVimHandling = vimMode;
            const keyLower = e.key.toLowerCase();
            const noModifiers = !e.metaKey && !e.ctrlKey && !e.altKey;

            // 1. Global Escape Handling (Highest Priority)
            if (e.key === "Escape") {
                if (isVimPreviewing) {
                    e.preventDefault();
                    e.stopPropagation();
                    setVimMode(false);
                    exitVimPreview();
                    return;
                }
                if (phase === "finished" && problemCount > 1) {
                    e.preventDefault();
                    e.stopPropagation();
                    enableEditorFocus();
                    onNextProblem();
                    return;
                }
                if (phase === "running" || phase === "countdown") {
                    clearAutoAdvance();
                    onReset();

                    // If Vim mode is enabled, go back to preview instead of just resetting
                    if (vimMode) {
                        beginVimPreview();
                        // Allow propagation so monaco-vim sees Esc and exits Insert mode
                        return;
                    }

                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
            }

            // 2. Shift+A opens AI drills. This MUST come before the idle typing guard
            // (which would feed "A" to the engine and start a run) and before the
            // plain-"a" analytics passthrough further down (which returned early and
            // swallowed the shortcut in the finished phase).
            if (
                e.shiftKey &&
                noModifiers &&
                keyLower === "a" &&
                phase !== "running" &&
                phase !== "countdown" &&
                onOpenAIDrill
            ) {
                e.preventDefault();
                e.stopPropagation();
                onOpenAIDrill();
                return;
            }

            // 3. Idle Typing Guard: in idle phase, printable keys bypass all shortcuts and
            // go directly to the engine. This prevents r/n/q/l/v/p/a from firing as
            // shortcuts when a snippet starts with those characters.
            if (phase === "idle" && noModifiers) {
                const isPrintable = e.key.length === 1 || e.key === "Enter" || e.key === "Tab";
                if (isPrintable) {
                    enableEditorFocus();
                    engineHandleKeyDown(e);
                    return;
                }
            }

            // 4. Vim Toggle (v) - Allow toggling ON/OFF only in finished phase
            if (noModifiers && keyLower === "v" && phase === "finished") {
                e.preventDefault();
                e.stopPropagation();
                if (isVimPreviewing || vimMode) {
                    setVimMode(false);
                    exitVimPreview();
                } else {
                    beginVimPreview();
                }
                return;
            }

            // 5. Vim Preview Mode - Delegate to Monaco, ignore Engine
            if (isVimPreviewing) {
                // Handle 'i' to start typing
                if (keyLower === "i" && noModifiers) {
                    // Allow propagation so monaco-vim enters Insert mode
                    setVimMode(true);
                    setIsVimPreviewing(false);
                    enableEditorFocus();
                    onReset();
                    onStartEngine();
                    focusEditor();
                    return;
                }

                // Handle shortcuts that should work in preview
                if (noModifiers) {
                    if (keyLower === "r") {
                        e.preventDefault();
                        e.stopPropagation();
                        setVimMode(false);
                        exitVimPreview();
                        enableEditorFocus();
                        onReset();
                        onStartEngine();
                        focusEditor();
                        return;
                    }
                    if (keyLower === "n" || keyLower === "q") {
                        e.preventDefault();
                        e.stopPropagation();
                        enableEditorFocus();
                        onNextProblem();
                        return;
                    }
                }
                return;
            }

            // 6. Global Shortcuts (Non-Vim, only active in finished phase due to idle guard above)
            if (noModifiers) {
                // Handle Tab and Space to go to next test when finished
                if (phase === "finished" && problemCount > 1) {
                    if (e.key === "Tab" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        enableEditorFocus();
                        onNextProblem();
                        return;
                    }
                }
                if (keyLower === "r" && phase !== "running") {
                    e.preventDefault();
                    e.stopPropagation();
                    enableEditorFocus();
                    onReset();
                    onStartEngine();
                    focusEditor();
                    return;
                }
                if ((keyLower === "n" || keyLower === "q") && phase !== "running") {
                    e.preventDefault();
                    e.stopPropagation();
                    enableEditorFocus();
                    onNextProblem();
                    return;
                }
                if (keyLower === "l") {
                    if (phase !== "running") {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowLiveStatsDuringRun(!showLiveStatsDuringRun);
                        return;
                    }
                }
                if (keyLower === "p" && phase !== "running") {
                    // Allow propagation to AppShell for preferences drawer
                    return;
                }
                if (keyLower === "a" && phase !== "running") {
                    // Allow propagation to AppShell for analytics modal
                    return;
                }
            }

            // 7. Pass to Engine (Typing)
            if (allowVimHandling) {
                enableEditorFocus();
                engineHandleKeyDown(e);
                return;
            }

            // Standard typing
            enableEditorFocus();
            engineHandleKeyDown(e);
        }

        function onPaste(e: ClipboardEvent) {
            e.preventDefault();
        }

        document.addEventListener("keydown", onKeyDown, true);
        window.addEventListener("paste", onPaste);

        return () => {
            document.removeEventListener("keydown", onKeyDown, true);
            window.removeEventListener("paste", onPaste);
        };
    }, []);

    return {
        isVimPreviewing,
        setIsVimPreviewing,
        beginVimPreview,
        exitVimPreview,
    };
}
