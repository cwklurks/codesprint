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

const SHELL_MODAL_EVENT = "codesprint-open-modal";

function openShellModal(modal: "preferences" | "analytics") {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent(SHELL_MODAL_EVENT, { detail: modal }));
}

/**
 * Hook to manage global keyboard shortcuts and event listeners
 * Extracted from TypingSession.tsx keyboard handling logic
 *
 * Manages a 7-level keyboard event hierarchy:
 * 1. Global Escape Handling (Highest Priority)
 * 2. Idle shell shortcuts (when focus is not inside Monaco)
 * 3. Idle Typing Guard (printable keys in idle bypass shortcuts → engine)
 * 4. Vim Toggle (v key, finished phase only)
 * 5. Vim Preview Mode
 * 6. Global Shortcuts
 * 7. Pass to Engine (Typing)
 */
export function useKeyboardShortcuts({
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
}: UseKeyboardShortcutsProps): UseKeyboardShortcutsReturn {
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

    // Main keyboard event handler
    useEffect(() => {
        function onKeyDown(e: KeyboardEvent) {
            const allowVimHandling = vimMode;
            const keyLower = e.key.toLowerCase();
            const target = e.target;
            const isEditorTarget = target instanceof Element && Boolean(target.closest(".monaco-editor"));

            // 0. Overlay guard: if a Chakra dialog/drawer is open, let it handle all keys.
            // This prevents game shortcuts and the idle typing guard from stealing keystrokes
            // while a modal/drawer is open. Escape propagates to Chakra which closes the overlay.
            if (
                typeof document !== "undefined" &&
                document.querySelector('[data-scope="dialog"][data-state="open"], [data-scope="drawer"][data-state="open"]')
            ) {
                return;
            }

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

            // 2. Idle shell shortcuts: when focus is outside Monaco, documented
            // global shortcuts should win over the typing engine. If the user has
            // focused the editor, printable keys still start/type the snippet.
            if (phase === "idle" && !isEditorTarget && !e.metaKey && !e.ctrlKey && !e.altKey) {
                if (e.shiftKey && keyLower === "a" && onOpenAIDrill) {
                    e.preventDefault();
                    e.stopPropagation();
                    onOpenAIDrill();
                    return;
                }
                if (keyLower === "r") {
                    e.preventDefault();
                    e.stopPropagation();
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
                if (keyLower === "l") {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowLiveStatsDuringRun(!showLiveStatsDuringRun);
                    return;
                }
                if (keyLower === "p" || keyLower === "a") {
                    e.preventDefault();
                    e.stopPropagation();
                    openShellModal(keyLower === "p" ? "preferences" : "analytics");
                    return;
                }
            }

            // 3. Idle Typing Guard: in idle phase, printable keys go directly to
            // the engine after shell-level shortcuts have had a chance to run.
            if (phase === "idle" && !e.metaKey && !e.ctrlKey && !e.altKey) {
                const isPrintable = e.key.length === 1 || e.key === "Enter" || e.key === "Tab";
                if (isPrintable) {
                    enableEditorFocus();
                    engineHandleKeyDown(e);
                    return;
                }
            }

            // Block key-repeat for all shortcuts below (vim toggle, vim preview, global shortcuts).
            // Typing repeats are allowed — they reach the engine via section 6 or the idle guard.
            if (e.repeat && phase !== "running") return;

            // 4. Vim Toggle (v) - Allow toggling ON/OFF only in finished phase
            if (!e.metaKey && !e.ctrlKey && !e.altKey && keyLower === "v" && phase === "finished") {
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
                if (keyLower === "i" && !e.metaKey && !e.ctrlKey && !e.altKey) {
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
                if (!e.metaKey && !e.ctrlKey && !e.altKey) {
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

            // 6. Global Shortcuts
            if (!e.metaKey && !e.ctrlKey && !e.altKey) {
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
                // Shift+A for AI Drills
                if (e.shiftKey && keyLower === "a" && phase !== "running" && phase !== "countdown" && onOpenAIDrill) {
                    e.preventDefault();
                    e.stopPropagation();
                    onOpenAIDrill();
                    return;
                }
                if (keyLower === "p" && phase !== "running") {
                    e.preventDefault();
                    e.stopPropagation();
                    openShellModal("preferences");
                    return;
                }
                if (keyLower === "a" && phase !== "running") {
                    e.preventDefault();
                    e.stopPropagation();
                    openShellModal("analytics");
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
    }, [
        phase,
        showLiveStatsDuringRun,
        vimMode,
        setShowLiveStatsDuringRun,
        setVimMode,
        onNextProblem,
        enableEditorFocus,
        onReset,
        onStartEngine,
        engineHandleKeyDown,
        beginVimPreview,
        exitVimPreview,
        isVimPreviewing,
        problemCount,
        focusEditor,
        clearAutoAdvance,
        onOpenAIDrill,
    ]);

    return {
        isVimPreviewing,
        setIsVimPreviewing,
        beginVimPreview,
        exitVimPreview,
    };
}
