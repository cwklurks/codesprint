"use client";

import { Box } from "@chakra-ui/react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { initVimMode, type VimMode } from "monaco-vim";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type * as Monaco from "monaco-editor";
import { getPreviewIndex, hexToRgb, toMonacoColor, withMonacoAlpha } from "@/lib/code-panel";
import {
    CARET_BLINK_TIMEOUT_MS,
    HEIGHT_BUFFER_LINES,
    LINE_HEIGHT_MULTIPLIER,
    MAX_EDITOR_HEIGHT,
    MIN_EDITOR_HEIGHT,
} from "@/lib/constants";
import { THEME_PRESETS, usePreferences, type SurfaceStyle } from "@/lib/preferences";

type MonacoModule = typeof import("monaco-editor");

type CodePanelProps = {
    content: string;
    cursorChar: number;
    wrongChars: Set<number>;
    language: "javascript" | "python" | "java" | "cpp";
    caretErrorActive: boolean;
    onReady?: (focusEditor: () => void) => void;
    fontSize: number;
    surfaceStyle: SurfaceStyle;
    syntaxHighlighting: "full" | "partial" | "none";
};

const LINE_BREAK_REGEX = /\r\n|\r|\n/;

export default function CodePanel({
    content,
    cursorChar,
    wrongChars,
    language,
    caretErrorActive,
    onReady,
    fontSize,
    surfaceStyle,
    syntaxHighlighting,
}: CodePanelProps) {
    const { preferences } = usePreferences();
    const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
    const monacoRef = useRef<MonacoModule | null>(null);
    const decorationIdsRef = useRef<string[]>([]);
    const caretNodeRef = useRef<HTMLSpanElement | null>(null);
    const caretLayerRef = useRef<HTMLElement | null>(null);
    const caretPositionRef = useRef<Monaco.Position | null>(null);
    const caretAnimFrameRef = useRef<number | null>(null);
    const caretBlinkTimeoutRef = useRef<number | null>(null);
    const [editorReadyToken, setEditorReadyToken] = useState(0);
    const caretUpdatePendingRef = useRef(false);
    const vimModeRef = useRef<VimMode | null>(null);
    const statusNodeRef = useRef<HTMLDivElement | null>(null);

    const derivedLineHeight = useMemo(() => Math.round(fontSize * LINE_HEIGHT_MULTIPLIER), [fontSize]);
    const estimatedHeight = useMemo(() => {
        const lines = content.split("\n").length + HEIGHT_BUFFER_LINES;
        return Math.min(MAX_EDITOR_HEIGHT, Math.max(MIN_EDITOR_HEIGHT, lines * derivedLineHeight));
    }, [content, derivedLineHeight]);
    const snippetKey = useMemo(() => `${language}-${content.length}-${content.slice(0, 16)}`, [language, content]);
    const totalLines = useMemo(() => {
        if (!content) return 1;
        return content.split(LINE_BREAK_REGEX).length;
    }, [content]);
    const activeLine = useMemo(() => {
        const safeIndex = Math.max(0, Math.min(cursorChar, content.length));
        if (safeIndex === 0) return 1;
        const before = content.slice(0, safeIndex);
        return Math.max(1, before.split(LINE_BREAK_REGEX).length);
    }, [content, cursorChar]);
    const linesRemaining = Math.max(0, totalLines - activeLine);
    const completedAll = cursorChar >= content.length && content.length > 0;
    const lineCountdownLabel = completedAll
        ? "All lines completed"
        : linesRemaining === 0
            ? "Final line..."
            : `${linesRemaining} more ${linesRemaining === 1 ? "line" : "lines"} left...`;
    const showLineCountdown = totalLines > 1 || completedAll;
    const triggerCaretActivity = useCallback(() => {
        const caretNode = caretNodeRef.current;
        if (!caretNode) return;
        caretNode.classList.add("cs-caret-active");
        if (caretBlinkTimeoutRef.current !== null) {
            window.clearTimeout(caretBlinkTimeoutRef.current);
        }
        caretBlinkTimeoutRef.current = window.setTimeout(() => {
            caretNode.classList.remove("cs-caret-active");
            caretBlinkTimeoutRef.current = null;
        }, CARET_BLINK_TIMEOUT_MS);
    }, []);

    const ensureCaretNode = useCallback(() => {
        const editor = editorRef.current;
        if (!editor) return;
        const root = editor.getDomNode();
        if (!root) return;
        const overlayLayer = root.querySelector(".overflow-guard") as HTMLElement | null;
        if (!overlayLayer) return;
        const existing = caretNodeRef.current;
        if (existing && overlayLayer.contains(existing)) {
            caretLayerRef.current = overlayLayer;
            return;
        }
        if (existing && existing.parentElement) {
            existing.parentElement.removeChild(existing);
        }
        const caretNode = document.createElement("span");
        caretNode.className = "cs-caret cs-caret-hidden";
        caretNode.setAttribute("aria-hidden", "true");
        caretNode.style.pointerEvents = "none";
        caretNode.style.zIndex = "20";
        caretNode.style.setProperty("--caret-x", "0px");
        caretNode.style.setProperty("--caret-y", "0px");
        caretNode.style.setProperty("--caret-height", `${derivedLineHeight}px`);
        overlayLayer.appendChild(caretNode);
        caretNodeRef.current = caretNode;
        caretLayerRef.current = overlayLayer;
    }, [derivedLineHeight]);

    const scheduleCaretRender = useCallback(() => {
        if (typeof window === "undefined") return;
        if (caretUpdatePendingRef.current) return;
        caretUpdatePendingRef.current = true;
        ensureCaretNode();
        caretAnimFrameRef.current = window.requestAnimationFrame(() => {
            caretUpdatePendingRef.current = false;
            const editor = editorRef.current;
            const caretNode = caretNodeRef.current;
            const position = caretPositionRef.current;
            if (!caretNode || !editor || !position) {
                caretNode?.classList.add("cs-caret-hidden");
                return;
            }
            const coords = editor.getScrolledVisiblePosition(position);
            if (!coords) {
                caretNode.classList.add("cs-caret-hidden");
                return;
            }
            caretNode.classList.remove("cs-caret-hidden");
            const x = Math.max(0, coords.left);
            const y = coords.top;
            caretNode.style.setProperty("--caret-x", `${Math.round(x)}px`);
            caretNode.style.setProperty("--caret-y", `${Math.round(y)}px`);
            caretNode.style.setProperty("--caret-height", `${Math.round(coords.height)}px`);
        });
    }, [ensureCaretNode]);

    // Theme Management
    useEffect(() => {
        const monaco = monacoRef.current;
        if (!monaco) return;

        const theme = THEME_PRESETS[preferences.theme];
        const bgRgb = hexToRgb(theme.bg);
        const luminance = 0.299 * bgRgb[0] + 0.587 * bgRgb[1] + 0.114 * bgRgb[2];
        const isLight = luminance > 128;

        // Helper to apply 25% opacity to a color for the "untyped" state
        const fade = (color: string) => withMonacoAlpha(color, 0.25);

        const themeName = `codesprint-${preferences.theme}`;
        try {
            monaco.editor.defineTheme(themeName, {
                base: isLight ? "vs" : "vs-dark",
                inherit: true,
                rules: [
                    { token: "", foreground: fade(theme.text).replace("#", "") },
                    { token: "comment", foreground: fade(theme.textSubtle).replace("#", "") },
                    ...(syntaxHighlighting === "partial"
                        ? [
                            { token: "identifier", foreground: fade(theme.text).replace("#", "") },
                            { token: "string", foreground: fade(theme.text).replace("#", "") },
                            { token: "delimiter", foreground: fade(theme.text).replace("#", "") },
                            { token: "number", foreground: fade(theme.text).replace("#", "") },
                            { token: "regexp", foreground: fade(theme.text).replace("#", "") },
                            { token: "keyword", foreground: fade(theme.accent).replace("#", "") },
                            { token: "type", foreground: fade(theme.accent).replace("#", "") },
                        ]
                        : [
                            { token: "keyword", foreground: fade(theme.accent).replace("#", "") },
                            { token: "type", foreground: fade(theme.accent).replace("#", "") },
                            { token: "identifier", foreground: fade(theme.text).replace("#", "") },
                            { token: "string", foreground: fade(theme.accent).replace("#", "") },
                            { token: "number", foreground: fade(theme.accent).replace("#", "") },
                            { token: "regexp", foreground: fade(theme.accent).replace("#", "") },
                            { token: "delimiter", foreground: fade(theme.textSubtle).replace("#", "") },
                            { token: "delimiter.html", foreground: fade(theme.textSubtle).replace("#", "") },
                            { token: "tag", foreground: fade(theme.accent).replace("#", "") },
                            { token: "attribute.name", foreground: fade(theme.text).replace("#", "") },
                            { token: "attribute.value", foreground: fade(theme.accent).replace("#", "") },
                        ]),
                ],
                colors: {
                    "editor.background": "#00000000",
                    "editor.foreground": fade(theme.text),
                    "editorCursor.foreground": toMonacoColor(theme.caret),
                    "editor.lineHighlightBackground": toMonacoColor(theme.surface),
                    "editorLineNumber.foreground": toMonacoColor(theme.textSubtle),
                    "editorLineNumber.activeForeground": toMonacoColor(theme.accent),
                    "editor.selectionBackground": toMonacoColor(theme.surfaceActive),
                    "editor.inactiveSelectionBackground": toMonacoColor(theme.surface),
                },
            });
            monaco.editor.setTheme(themeName);
        } catch (error) {
            console.error(`Failed to apply Monaco theme "${preferences.theme}"`, error);
            monaco.editor.setTheme(isLight ? "vs" : "vs-dark");
        }
    }, [preferences.theme, syntaxHighlighting, editorReadyToken]);

    // Vim Mode Management
    useEffect(() => {
        const editor = editorRef.current;
        if (!editor) return;

        if (preferences.vimMode) {
            if (!vimModeRef.current) {
                const statusNode = document.createElement("div");
                statusNode.className = "vim-status-bar";
                statusNode.style.position = "absolute";
                statusNode.style.bottom = "0";
                statusNode.style.right = "0";
                statusNode.style.padding = "4px 12px";
                statusNode.style.fontSize = "12px";
                statusNode.style.fontFamily = "var(--font-mono)";
                statusNode.style.color = "var(--text)";
                statusNode.style.background = "var(--surface)";
                statusNode.style.borderTopLeftRadius = "8px";
                statusNode.style.border = "1px solid var(--border)";
                statusNode.style.borderRight = "none";
                statusNode.style.borderBottom = "none";
                statusNode.style.zIndex = "10";
                statusNode.style.opacity = "0.9";

                // Find the editor container to append the status bar
                const editorDom = editor.getDomNode();
                if (editorDom && editorDom.parentElement) {
                    // We need to be careful. monaco-vim expects to be able to append to the container.
                    // Sometimes the parentElement is the scrollable element.
                    // Let's try to find the wrapper we created.
                    // editorDom.parentElement is usually the .monaco-editor div.
                    // We want to append to the CodePanel container if possible, or just absolute position it relative to the editor.

                    // Actually, let's append to the editor's container so it stays with it.
                    editorDom.parentElement.appendChild(statusNode);
                    statusNodeRef.current = statusNode;
                }

                try {
                    vimModeRef.current = initVimMode(editor, statusNode);
                } catch (e) {
                    console.error("Failed to init vim mode", e);
                }
            }
        } else {
            if (vimModeRef.current) {
                vimModeRef.current.dispose();
                vimModeRef.current = null;
                if (statusNodeRef.current && statusNodeRef.current.parentElement) {
                    statusNodeRef.current.parentElement.removeChild(statusNodeRef.current);
                    statusNodeRef.current = null;
                }
            }
        }

        return () => {
            // Cleanup on unmount is handled by the separate cleanup effect, 
            // but we should also handle preference changes here if needed.
            // Actually, let's leave cleanup to the main cleanup effect or when toggled off.
        };
    }, [preferences.vimMode, editorReadyToken]);

    const handleMount: OnMount = (editor, monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;
        editor.updateOptions({
            readOnly: true,
            domReadOnly: true,
            fontSize,
            lineHeight: derivedLineHeight,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: "off",
            tabSize: 4,
            smoothScrolling: true,
            occurrencesHighlight: "off",
            selectionHighlight: false,
            renderLineHighlight: "none",
            guides: { indentation: false, highlightActiveIndentation: false },
            cursorBlinking: "solid",
            cursorStyle: "line",
            scrollbar: { vertical: "hidden", horizontal: "hidden", useShadows: false },
            glyphMargin: false,
            folding: false,
            lineNumbers: surfaceStyle === "panel" ? "on" : "off",
            lineNumbersMinChars: surfaceStyle === "panel" ? 3 : 0,
        });
        ensureCaretNode();
        if (onReady) {
            onReady(() => editor.focus());
        }
        setEditorReadyToken((prev) => prev + 1);
    };

    useEffect(() => {
        const editor = editorRef.current;
        if (!editor) return;
        editor.updateOptions({ fontSize, lineHeight: derivedLineHeight });
    }, [fontSize, derivedLineHeight]);

    useEffect(() => {
        ensureCaretNode();
        const caretNode = caretNodeRef.current;
        if (caretNode) {
            caretNode.style.setProperty("--caret-height", `${derivedLineHeight}px`);
        }
    }, [derivedLineHeight, ensureCaretNode]);

    useEffect(() => {
        ensureCaretNode();
        const editor = editorRef.current;
        if (!editor) return;
        editor.updateOptions({
            lineNumbers: surfaceStyle === "panel" ? "on" : "off",
            lineNumbersMinChars: surfaceStyle === "panel" ? 3 : 0,
        });
    }, [surfaceStyle, ensureCaretNode]);

    useEffect(() => {
        ensureCaretNode();
        const editor = editorRef.current;
        if (!editor) return;
        const disposables = [
            editor.onDidScrollChange(() => scheduleCaretRender()),
            editor.onDidLayoutChange(() => scheduleCaretRender()),
            editor.onDidContentSizeChange(() => scheduleCaretRender()),
        ];
        return () => {
            disposables.forEach((disposable) => disposable.dispose());
        };
    }, [scheduleCaretRender, ensureCaretNode]);

    useEffect(() => {
        ensureCaretNode();
        const editor = editorRef.current;
        const monaco = monacoRef.current;
        if (!editor || !monaco) return;
        const model = editor.getModel();
        if (!model) return;

        const caretIndex = Math.max(0, Math.min(cursorChar, content.length));
        const caretPosition = model.getPositionAt(caretIndex);
        caretPositionRef.current = caretPosition;
        scheduleCaretRender();
        triggerCaretActivity();
        if (!caretPosition) return;

        const previewIndex = getPreviewIndex(content, caretIndex);
        const previewPosition = model.getPositionAt(previewIndex);
        const previewRange = new monaco.Range(
            caretPosition.lineNumber,
            caretPosition.column,
            previewPosition.lineNumber,
            previewPosition.column,
        );

        editor.revealRangeNearTopIfOutsideViewport(previewRange, monaco.editor.ScrollType.Immediate);
    }, [cursorChar, content, editorReadyToken, scheduleCaretRender, triggerCaretActivity, ensureCaretNode]);

    // Caret error visual toggle (cheap - no decoration work)
    useEffect(() => {
        const caretNode = caretNodeRef.current;
        if (caretNode) {
            caretNode.classList.toggle("cs-caret-error", caretErrorActive);
        }
    }, [caretErrorActive]);

    useEffect(() => {
        ensureCaretNode();
        const editor = editorRef.current;
        const monaco = monacoRef.current;
        if (!editor || !monaco) return;
        const model = editor.getModel();
        if (!model) return;

        const caretIndex = Math.max(0, Math.min(cursorChar, content.length));

        const completedDecorations: Monaco.editor.IModelDeltaDecoration[] = [];
        let rangeStart = -1;
        for (let index = 0; index <= caretIndex; index += 1) {
            const isCompleted = index < caretIndex && !wrongChars.has(index);
            if (isCompleted) {
                if (rangeStart === -1) {
                    rangeStart = index;
                }
                continue;
            }
            if (rangeStart !== -1) {
                const startPos = model.getPositionAt(rangeStart);
                const endPos = model.getPositionAt(index);
                completedDecorations.push({
                    range: new monaco.Range(
                        startPos.lineNumber,
                        startPos.column,
                        endPos.lineNumber,
                        endPos.column,
                    ),
                    options: { inlineClassName: "cs-complete" },
                });
                rangeStart = -1;
            }
        }
        if (rangeStart !== -1) {
            const startPos = model.getPositionAt(rangeStart);
            const endPos = model.getPositionAt(caretIndex);
            completedDecorations.push({
                range: new monaco.Range(
                    startPos.lineNumber,
                    startPos.column,
                    endPos.lineNumber,
                    endPos.column,
                ),
                options: { inlineClassName: "cs-complete" },
            });
        }

        const errorDecorations: Monaco.editor.IModelDeltaDecoration[] = Array.from(wrongChars).map((abs) => {
            const pos = model.getPositionAt(abs);
            return {
                range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column + 1),
                options: { inlineClassName: "cs-wrong" },
            };
        });

        decorationIdsRef.current = editor.deltaDecorations(decorationIdsRef.current, [
            ...completedDecorations,
            ...errorDecorations,
        ]);
    }, [cursorChar, wrongChars, content, editorReadyToken, ensureCaretNode]);

    useEffect(() => {
        return () => {
            const editor = editorRef.current;
            if (editor && decorationIdsRef.current.length) {
                editor.deltaDecorations(decorationIdsRef.current, []);
                decorationIdsRef.current = [];
            }
            if (caretAnimFrameRef.current !== null) {
                window.cancelAnimationFrame(caretAnimFrameRef.current);
            }
            if (caretBlinkTimeoutRef.current !== null) {
                window.clearTimeout(caretBlinkTimeoutRef.current);
            }
            if (caretLayerRef.current && caretNodeRef.current && caretLayerRef.current.contains(caretNodeRef.current)) {
                caretLayerRef.current.removeChild(caretNodeRef.current);
            }
            caretNodeRef.current = null;
            caretLayerRef.current = null;
            caretPositionRef.current = null;
            caretUpdatePendingRef.current = false;

            if (vimModeRef.current) {
                vimModeRef.current.dispose();
                vimModeRef.current = null;
            }
            if (statusNodeRef.current && statusNodeRef.current.parentElement) {
                statusNodeRef.current.parentElement.removeChild(statusNodeRef.current);
                statusNodeRef.current = null;
            }
        };
    }, []);

    const panelProps =
        surfaceStyle === "panel"
            ? {
                borderRadius: "24px",
                border: "1px solid var(--border)",
                bg: "var(--panel)",
                boxShadow: "var(--shadow)",
                p: { base: 4, md: 6 },
            }
            : {
                borderRadius: "18px",
                border: "none",
                boxShadow: "none",
                background: "var(--bg-gradient)",
                color: "inherit",
                p: { base: 3, md: 4 },
            };

    const editorLanguage = syntaxHighlighting === "none" ? "plaintext" : language;

    return (
        <Box {...panelProps} minH={`${estimatedHeight}px`} transition="background 0.3s ease" position="relative">
            <Editor
                key={snippetKey}
                value={content}
                language={editorLanguage}
                // theme is handled by useEffect, but we provide a safe default
                theme="vs-dark"
                height={estimatedHeight}
                options={{
                    readOnly: true,
                    domReadOnly: true,
                    automaticLayout: true,
                    scrollbar: { vertical: "hidden", horizontal: "hidden" },
                }}
                onMount={handleMount}
            />
            {showLineCountdown ? (
                <Box
                    position="absolute"
                    bottom={surfaceStyle === "panel" ? 3 : 2}
                    left="50%"
                    transform="translateX(-50%)"
                    textAlign="center"
                    fontSize="sm"
                    color="var(--text-subtle)"
                    pointerEvents="none"
                    px={3}
                >
                    {lineCountdownLabel}
                </Box>
            ) : null}
        </Box>
    );
}
