"use client";

import { Box } from "@chakra-ui/react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type * as Monaco from "monaco-editor";
import type { SurfaceStyle } from "@/lib/preferences";

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
    syntaxHighlightingEnabled: boolean;
};

const LINE_HEIGHT_MULTIPLIER = 1.55;
const HEIGHT_BUFFER_LINES = 4;
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
    syntaxHighlightingEnabled,
}: CodePanelProps) {
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

    const derivedLineHeight = useMemo(() => Math.round(fontSize * LINE_HEIGHT_MULTIPLIER), [fontSize]);
    const estimatedHeight = useMemo(() => {
        const lines = content.split("\n").length + HEIGHT_BUFFER_LINES;
        return Math.min(720, Math.max(320, lines * derivedLineHeight));
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
        }, 650);
    }, []);

    const ensureCaretNode = useCallback(() => {
        const editor = editorRef.current;
        if (!editor) return;
        const root = editor.getDomNode();
        if (!root) return;
        const overlayLayer = root.querySelector(".view-overlays") as HTMLElement | null;
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
            const layoutInfo = editor.getLayoutInfo();
            const contentLeft = layoutInfo ? layoutInfo.contentLeft : 0;
            const x = Math.max(0, coords.left - contentLeft);
            const y = coords.top;
            caretNode.style.setProperty("--caret-x", `${Math.round(x)}px`);
            caretNode.style.setProperty("--caret-y", `${Math.round(y)}px`);
            caretNode.style.setProperty("--caret-height", `${Math.round(coords.height)}px`);
        });
    }, [ensureCaretNode]);

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
        if (caretPosition && editor) {
            if (monaco) {
                editor.revealPositionInCenterIfOutsideViewport(caretPosition, monaco.editor.ScrollType.Smooth);
            } else {
                editor.revealPositionInCenterIfOutsideViewport(caretPosition);
            }
        }

        const caretNode = caretNodeRef.current;
        if (caretNode) {
            caretNode.classList.toggle("cs-caret-error", caretErrorActive);
        }

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
    }, [cursorChar, wrongChars, content, caretErrorActive, editorReadyToken, scheduleCaretRender, triggerCaretActivity, ensureCaretNode]);

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

    const editorLanguage = syntaxHighlightingEnabled ? language : "plaintext";

    return (
        <Box {...panelProps} minH={`${estimatedHeight}px`} transition="background 0.3s ease" position="relative">
            <Editor
                key={snippetKey}
                value={content}
                language={editorLanguage}
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
