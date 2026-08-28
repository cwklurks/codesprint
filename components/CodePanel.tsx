"use client";

import { Box } from "@chakra-ui/react";
import Editor, { loader, type OnMount } from "@monaco-editor/react";
import type { VimMode } from "monaco-vim";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type * as Monaco from "monaco-editor";

// The editor core WITHOUT the bundled language services (typescript/json/css/html),
// plus monarch tokenizers for exactly the four languages this app types.
import * as monacoBundle from "monaco-editor/esm/vs/editor/editor.api";
import "monaco-editor/esm/vs/editor/editor.all";
import "monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution";
import "monaco-editor/esm/vs/basic-languages/python/python.contribution";
import "monaco-editor/esm/vs/basic-languages/java/java.contribution";
import "monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution";

import { estimateEditorHeight, getPreviewIndex, hexToRgb, toMonacoColor, withMonacoAlpha } from "@/lib/code-panel";
import { minAlphaForContrast } from "@/lib/contrast";
import {
    CARET_BLINK_TIMEOUT_MS,
    LINE_HEIGHT_MULTIPLIER,
} from "@/lib/constants";
import { usePrefersReducedMotion } from "@/lib/motion";
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

// The app's single mono voice (next/font JetBrains Mono, see app/globals.css).
const MONACO_FONT_FAMILY = "var(--font-mono), ui-monospace, Menlo, Consolas, monospace";

// Without this, @monaco-editor/react fetches a SECOND copy of Monaco (0.54.0)
// from jsdelivr at runtime while monaco-vim's npm copy (0.52.2) is already in the
// bundle: two downloads, two versions, and a third-party runtime dependency.
loader.config({ monaco: monacoBundle as unknown as typeof Monaco });

// Bundled Monaco needs its own worker factory; the AMD/CDN loader used to supply one.
if (typeof window !== "undefined") {
    const globalWithEnv = window as Window & {
        MonacoEnvironment?: { getWorker?: (moduleId: string, label: string) => Worker };
    };
    globalWithEnv.MonacoEnvironment ??= {
        getWorker: () =>
            new Worker(new URL("monaco-editor/esm/vs/editor/editor.worker.js", import.meta.url)),
    };
}

function CodePanel({
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
    const prefersReducedMotion = usePrefersReducedMotion();
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
    // Full content height, uncapped: the editor never scrolls internally, so the
    // page is the single smooth scroll authority that follows the caret.
    const estimatedHeight = useMemo(() => estimateEditorHeight(content, fontSize), [content, fontSize]);
    const snippetKey = `${language}-${content.length}-${content.slice(0, 16)}`;
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

    // Write the caret's pixel position from Monaco geometry. SYNCHRONOUS so it can run
    // inside a layout effect (before paint) on each keystroke — this removes the ~1-2
    // frame input-to-move latency (useEffect -> rAF) that made the glide feel laggy.
    // getScrolledVisiblePosition is pure model+scroll math (no re-render required), so
    // it returns correct coords when read here. The CSS transition then glides from the
    // caret's current (possibly mid-flight) position to the new one, like Monkeytype.
    const renderCaretNow = useCallback(() => {
        if (typeof window === "undefined") return;
        ensureCaretNode();
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
    }, [ensureCaretNode]);

    // Coalesced (rAF) variant for high-frequency listeners (scroll / layout / content
    // size) where writing on every event synchronously would thrash layout.
    const scheduleCaretRender = useCallback(() => {
        if (typeof window === "undefined") return;
        if (caretUpdatePendingRef.current) return;
        caretUpdatePendingRef.current = true;
        ensureCaretNode();
        caretAnimFrameRef.current = window.requestAnimationFrame(() => {
            caretUpdatePendingRef.current = false;
            renderCaretNow();
        });
    }, [ensureCaretNode, renderCaretNow]);

    // Build + apply the per-theme Monaco theme. Extracted from the effect so it can
    // ALSO run synchronously inside handleMount — applying the real theme before the
    // first paint avoids a one-frame syntax-token color shimmer on mount and on every
    // snippet change (the editor remounts per snippet via key={snippetKey}).
    const applyTheme = useCallback((monaco: MonacoModule) => {
        const theme = THEME_PRESETS[preferences.theme];
        const bgRgb = hexToRgb(theme.bg);
        const luminance = 0.299 * bgRgb[0] + 0.587 * bgRgb[1] + 0.114 * bgRgb[2];
        const isLight = luminance > 128;

        // Fade untyped (read-ahead) text to a muted state, but derive the alpha
        // per-theme so the composite over the theme bg clears the WCAG 3:1 floor.
        // A flat 0.25 left it near-invisible on low-contrast themes.
        const untypedAlpha = minAlphaForContrast(theme.text, theme.bg, 3.0);
        const fade = (color: string) => withMonacoAlpha(color, untypedAlpha);

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
    }, [preferences.theme, syntaxHighlighting]);

    // Re-apply on theme / syntax-highlighting changes and on (re)mount.
    useEffect(() => {
        const monaco = monacoRef.current;
        if (!monaco) return;
        applyTheme(monaco);
    }, [applyTheme, editorReadyToken]);

    // Vim Mode Management. vimMode defaults off, so monaco-vim is imported the
    // first time it is actually switched on rather than shipped to every user.
    useEffect(() => {
        const editor = editorRef.current;
        if (!editor) return;

        let cancelled = false;

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

                import("monaco-vim")
                    .then(({ initVimMode }) => {
                        // Vim was switched off again (or the editor remounted) while the
                        // chunk was in flight — do not attach to a stale editor.
                        if (cancelled || vimModeRef.current) return;
                        if (editorRef.current !== editor) return;
                        if (!statusNode.isConnected) return;
                        vimModeRef.current = initVimMode(editor, statusNode);
                    })
                    .catch((e) => {
                        console.error("Failed to init vim mode", e);
                    });
            }
        } else {
            if (vimModeRef.current) {
                vimModeRef.current.dispose();
                vimModeRef.current = null;
            }
            if (statusNodeRef.current && statusNodeRef.current.parentElement) {
                statusNodeRef.current.parentElement.removeChild(statusNodeRef.current);
                statusNodeRef.current = null;
            }
        }

        return () => {
            cancelled = true;
        };
    }, [preferences.vimMode, editorReadyToken]);

    const handleMount: OnMount = (editor, monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;
        // Apply the real theme before the first paint to avoid a vs-dark -> theme flash.
        applyTheme(monaco);
        editor.updateOptions({
            readOnly: true,
            domReadOnly: true,
            fontFamily: MONACO_FONT_FAMILY,
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
            matchBrackets: "never",
            guides: { indentation: false, highlightActiveIndentation: false, bracketPairs: false },
            cursorBlinking: "solid",
            cursorStyle: "line",
            scrollbar: { vertical: "hidden", horizontal: "hidden", useShadows: false },
            overviewRulerLanes: 0,
            overviewRulerBorder: false,
            hideCursorInOverviewRuler: true,
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

    // Monaco measures glyph widths once at mount. With a swapped webfont those
    // measurements are taken against the fallback, so re-measure when the real
    // face lands or every column position is off by a fraction.
    useEffect(() => {
        if (typeof document === "undefined" || !document.fonts) return;
        let cancelled = false;
        document.fonts.ready.then(() => {
            if (cancelled) return;
            monacoRef.current?.editor.remeasureFonts();
        });
        return () => {
            cancelled = true;
        };
    }, [editorReadyToken]);

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

    // Layout effect (not useEffect): write the caret position BEFORE the browser
    // paints the keystroke, so the glide starts from this frame instead of one or two
    // frames later. This is the main thing that makes the caret feel effortless.
    useLayoutEffect(() => {
        ensureCaretNode();
        const editor = editorRef.current;
        const monaco = monacoRef.current;
        if (!editor || !monaco) return;
        const model = editor.getModel();
        if (!model) return;

        const caretIndex = Math.max(0, Math.min(cursorChar, content.length));
        const caretPosition = model.getPositionAt(caretIndex);
        caretPositionRef.current = caretPosition;
        renderCaretNow();
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

        // Glide the reveal so a line change scrolls smoothly with the caret instead
        // of hard-cutting. ScrollType.Immediate ignores the editor's smoothScrolling
        // option, so we pass Smooth explicitly (and fall back to Immediate when the
        // user prefers reduced motion).
        editor.revealRangeNearTopIfOutsideViewport(
            previewRange,
            prefersReducedMotion ? monaco.editor.ScrollType.Immediate : monaco.editor.ScrollType.Smooth,
        );
    }, [cursorChar, content, editorReadyToken, renderCaretNow, triggerCaretActivity, ensureCaretNode, prefersReducedMotion]);

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
        const editorRefCapture = editorRef;
        const decorationIdsRefCapture = decorationIdsRef;
        const caretAnimFrameRefCapture = caretAnimFrameRef;
        const caretBlinkTimeoutRefCapture = caretBlinkTimeoutRef;
        const caretLayerRefCapture = caretLayerRef;
        const caretNodeRefCapture = caretNodeRef;
        const caretPositionRefCapture = caretPositionRef;
        const caretUpdatePendingRefCapture = caretUpdatePendingRef;
        const vimModeRefCapture = vimModeRef;
        const statusNodeRefCapture = statusNodeRef;
        return () => {
            const editor = editorRefCapture.current;
            if (editor && decorationIdsRefCapture.current.length) {
                editor.deltaDecorations(decorationIdsRefCapture.current, []);
                decorationIdsRefCapture.current = [];
            }
            if (caretAnimFrameRefCapture.current !== null) {
                window.cancelAnimationFrame(caretAnimFrameRefCapture.current);
            }
            if (caretBlinkTimeoutRefCapture.current !== null) {
                window.clearTimeout(caretBlinkTimeoutRefCapture.current);
            }
            if (
                caretLayerRefCapture.current &&
                caretNodeRefCapture.current &&
                caretLayerRefCapture.current.contains(caretNodeRefCapture.current)
            ) {
                caretLayerRefCapture.current.removeChild(caretNodeRefCapture.current);
            }
            caretNodeRefCapture.current = null;
            caretLayerRefCapture.current = null;
            caretPositionRefCapture.current = null;
            caretUpdatePendingRefCapture.current = false;

            if (vimModeRefCapture.current) {
                vimModeRefCapture.current.dispose();
                vimModeRefCapture.current = null;
            }
            if (statusNodeRefCapture.current && statusNodeRefCapture.current.parentElement) {
                statusNodeRefCapture.current.parentElement.removeChild(statusNodeRefCapture.current);
                statusNodeRefCapture.current = null;
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
                    fontFamily: MONACO_FONT_FAMILY,
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

// Memoized: the session re-renders on the metrics tick and the per-second history
// tick as well as on keystrokes; without this the editor re-rendered for all three.
export default memo(CodePanel);
