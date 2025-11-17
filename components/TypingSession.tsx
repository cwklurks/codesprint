"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Button, Flex, Stack, Text } from "@chakra-ui/react";
import type { ButtonProps } from "@chakra-ui/react";
import { AnimatePresence, motion } from "framer-motion";
import CodePanel from "@/components/CodePanel";
import LiveStats from "@/components/LiveStats";
import ResultCard from "@/components/ResultCard";
import { computeMetrics } from "@/lib/scoring";
import { getProblemSnippets, getProblems, getSnippet, type Problem, type Snippet, type SnippetLength } from "@/lib/snippets";
import { FADE_IN_UP, MOTION_DURATION, MOTION_EASE, POP_IN, SPRING_SMOOTH, usePrefersReducedMotion } from "@/lib/motion";
import { usePreferences } from "@/lib/preferences";
import type { MotionProps } from "framer-motion";

function normalizeWhitespace(ch: string) {
    return ch === "\r" ? "\n" : ch;
}

type LengthFilter = SnippetLength | "all";
type ErrorEntry = { expected: string; got: string; index: number };

export default function TypingSession() {
    const INDENT_WIDTH = 4;
    const [lang, setLang] = useState<"python" | "javascript" | "java" | "cpp">("javascript");
    const [lengthPref, setLengthPref] = useState<LengthFilter>("all");
    const [phase, setPhase] = useState<"idle" | "countdown" | "running" | "finished">("idle");
    const [countdown, setCountdown] = useState<number | null>(null);
    const [cursorIndex, setCursorIndex] = useState(0);
    const [wrongChars, setWrongChars] = useState<Set<number>>(new Set());
    const [startTime, setStartTime] = useState<number | null>(null);
    const [now, setNow] = useState<number>(Date.now());
    const [lastErrorAt, setLastErrorAt] = useState<number | null>(null);
    const [errorLog, setErrorLog] = useState<ErrorEntry[]>([]);
    const [totalTypedChars, setTotalTypedChars] = useState(0);
    const focusEditorRef = useRef<(() => void) | null>(null);
    const phaseRef = useRef(phase);
    const autoAdvanceTimeoutRef = useRef<number | null>(null);
    const panelContainerRef = useRef<HTMLDivElement | null>(null);
    const previousPhaseRef = useRef(phase);
    const [autoAdvanceDeadline, setAutoAdvanceDeadline] = useState<number | null>(null);
    const allowEditorFocusRef = useRef(false);
    const skipNextAutoScrollRef = useRef(false);
    const suppressAutoScrollUntilRef = useRef<number | null>(null);
    useEffect(() => {
        phaseRef.current = phase;
    }, [phase]);
    const { preferences, setSurfaceStyle: persistSurfaceStyle, setShowLiveStatsDuringRun } = usePreferences();
    const countdownEnabled = preferences.countdownEnabled;
    const editorFontSize = preferences.fontSize;
    const storedSurfaceStyle = preferences.surfaceStyle ?? "panel";
    const interfaceMode = preferences.interfaceMode;
    const isTerminalMode = interfaceMode === "terminal";
    const effectiveSurfaceStyle = isTerminalMode ? "immersive" : storedSurfaceStyle;
    const isImmersive = effectiveSurfaceStyle === "immersive";
    const handleEditorReady = useCallback((focus: () => void) => {
        focusEditorRef.current = focus;
        if (allowEditorFocusRef.current) {
            focus();
        }
    }, []);
    const enableEditorFocus = useCallback(() => {
        if (!allowEditorFocusRef.current) {
            allowEditorFocusRef.current = true;
        }
    }, []);
    const problemOptions = useMemo<Problem[]>(() => {
        const filters = lengthPref === "all" ? undefined : { length: lengthPref };
        return getProblems(lang, filters);
    }, [lang, lengthPref]);
    const [problemId, setProblemId] = useState(() => problemOptions[0]?.id ?? "");
    useEffect(() => {
        if (problemOptions.length === 0) {
            if (problemId !== "") setProblemId("");
            return;
        }
        if (!problemOptions.some((problem) => problem.id === problemId)) {
            setProblemId(problemOptions[0].id);
        }
    }, [problemOptions, problemId]);
    const snippetOptions = useMemo<Snippet[]>(() => {
        if (!problemId) return [];
        const filters = lengthPref === "all" ? undefined : { length: lengthPref };
        return getProblemSnippets(lang, problemId, filters);
    }, [lang, problemId, lengthPref]);
    const [snippetId, setSnippetId] = useState(() => snippetOptions[0]?.id ?? "");
    useEffect(() => {
        if (snippetOptions.length === 0) {
            if (snippetId !== "") setSnippetId("");
            return;
        }
        if (!snippetOptions.some((option) => option.id === snippetId)) {
            setSnippetId(snippetOptions[0].id);
        }
    }, [snippetOptions, snippetId]);
    const snippet = useMemo(() => {
        if (snippetOptions.length === 0) {
            const filters = lengthPref === "all" ? undefined : { length: lengthPref };
            return getSnippet(lang, filters);
        }
        const selected = snippetOptions.find((option) => option.id === snippetId);
        return selected ?? snippetOptions[0];
    }, [snippetOptions, snippetId, lang, lengthPref]);
    const total = snippet.content.length;
    const prefersReducedMotion = usePrefersReducedMotion();
    const scrollSessionIntoView = useCallback(() => {
        if (typeof window === "undefined") return;
        const container = panelContainerRef.current;
        if (!container) return;
        const behavior: ScrollBehavior = prefersReducedMotion ? "auto" : "smooth";

        const performScroll = () => {
            const caret = document.querySelector<HTMLElement>(".cs-caret");
            const rect = (caret ?? container).getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const scrollElement = document.scrollingElement ?? document.documentElement ?? document.body;
            const targetTop = window.scrollY + rect.top - viewportHeight / 2 + rect.height / 2;
            const maxTop =
                scrollElement && viewportHeight
                    ? Math.max(0, scrollElement.scrollHeight - viewportHeight)
                    : Number.POSITIVE_INFINITY;
            const clampedTop = Math.max(0, Math.min(targetTop, maxTop));
            if (Math.abs(clampedTop - window.scrollY) < 1) return;
            skipNextAutoScrollRef.current = true;
            suppressAutoScrollUntilRef.current = Date.now() + 800;
            window.scrollTo({
                top: clampedTop,
                behavior,
            });
        };

        if (prefersReducedMotion) {
            performScroll();
        } else {
            window.requestAnimationFrame(() => {
                window.requestAnimationFrame(performScroll);
            });
        }
    }, [prefersReducedMotion]);
    useEffect(() => {
        const prev = previousPhaseRef.current;
        const enteringCountdown = phase === "countdown" && prev !== "countdown";
        const enteringRunningDirect = phase === "running" && prev !== "running" && prev !== "countdown";
        if (enteringCountdown || enteringRunningDirect) {
            scrollSessionIntoView();
        }
        previousPhaseRef.current = phase;
    }, [phase, scrollSessionIntoView]);
    const started = phase === "running";
    const finished = phase === "finished";
    const isCountingDown = phase === "countdown";
    const controlsDisabled = started || isCountingDown;

    const cancelAutoAdvance = useCallback(() => {
        if (autoAdvanceTimeoutRef.current !== null) {
            window.clearTimeout(autoAdvanceTimeoutRef.current);
            autoAdvanceTimeoutRef.current = null;
        }
        setAutoAdvanceDeadline(null);
    }, []);

    const reset = useCallback((options?: { skipFocus?: boolean }) => {
        cancelAutoAdvance();
        setPhase("idle");
        setCountdown(null);
        setCursorIndex(0);
        setWrongChars(new Set());
        setStartTime(null);
        setNow(Date.now());
        setLastErrorAt(null);
        setErrorLog([]);
        setTotalTypedChars(0);
        if (!options?.skipFocus && allowEditorFocusRef.current) {
            focusEditorRef.current?.();
        }
    }, [cancelAutoAdvance]);

    const handleNextProblem = useCallback(() => {
        cancelAutoAdvance();
        if (problemOptions.length === 0) return;
        enableEditorFocus();
        reset();
        const currentIndex = problemOptions.findIndex((problem) => problem.id === problemId);
        const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % problemOptions.length : 0;
        const nextProblem = problemOptions[nextIndex];
        setProblemId(nextProblem.id);
    }, [cancelAutoAdvance, problemId, problemOptions, reset, enableEditorFocus]);

    // Timer tick
    useEffect(() => {
        if (!started) return;
        const id = setInterval(() => setNow(Date.now()), 100);
        return () => clearInterval(id);
    }, [started]);

    useEffect(() => {
        if (phase !== "countdown") return;
        if (prefersReducedMotion) {
            setCountdown(null);
            setPhase("running");
            return;
        }
        if (countdown === null) {
            setCountdown(3);
            return;
        }
        if (countdown === 0) {
            const id = window.setTimeout(() => {
                setCountdown(null);
                setPhase("running");
            }, 400);
            return () => window.clearTimeout(id);
        }
        const delay = countdown === 3 ? 600 : 1000;
        const id = window.setTimeout(() => {
            setCountdown((prev) => (prev ?? 1) - 1);
        }, delay);
        return () => window.clearTimeout(id);
    }, [phase, countdown, prefersReducedMotion]);

    const handleStartClick = useCallback(() => {
        enableEditorFocus();
        if (prefersReducedMotion || !countdownEnabled) {
            setCountdown(null);
            setPhase("running");
            focusEditorRef.current?.();
            return;
        }
        setCountdown(3);
        setPhase("countdown");
        focusEditorRef.current?.();
    }, [prefersReducedMotion, countdownEnabled, enableEditorFocus]);

    // Keystroke handling
    useEffect(() => {
        function onKeyDown(e: KeyboardEvent) {
            const keyLower = e.key.toLowerCase();

            let phaseNow = phaseRef.current;

            if (!e.metaKey && !e.ctrlKey && !e.altKey && keyLower) {
                if (keyLower === "r" && phaseNow !== "running") {
                    e.preventDefault();
                    e.stopPropagation();
                    enableEditorFocus();
                    reset({ skipFocus: true });
                    handleStartClick();
                    return;
                }
                if (keyLower === "n" && phaseNow !== "running") {
                    e.preventDefault();
                    e.stopPropagation();
                    enableEditorFocus();
                    handleNextProblem();
                    return;
                }
                if (keyLower === "l") {
                    if (phaseNow !== "running") {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowLiveStatsDuringRun(!preferences.showLiveStatsDuringRun);
                        return;
                    }
                }
            }

            if (e.key === "Meta" || e.key === "Alt" || e.key === "Control") return;

            enableEditorFocus();

            const autoAdvanceIndentationIfAllowed = (index: number): { advanced: number; nextIndex: number } => {
                const content = snippet.content;
                if (!content || content.length === 0) {
                    return { advanced: 0, nextIndex: index };
                }
                const previousChar = index === 0 ? "\n" : content[index - 1];
                if (index !== 0 && previousChar !== "\n" && previousChar !== "\r") {
                    return { advanced: 0, nextIndex: index };
                }
                let target = index;
                while (target < content.length) {
                    const ch = content[target];
                    if (ch !== " " && ch !== "\t") break;
                    target += 1;
                }
                const advanced = target - index;
                if (advanced === 0) {
                    return { advanced: 0, nextIndex: index };
                }
                const nextChar = content[target];
                const isBlankLine = nextChar === "\n" || nextChar === "\r" || typeof nextChar === "undefined";
                if (preferences.requireTabForIndent && !isBlankLine) {
                    return { advanced: 0, nextIndex: index };
                }
                setCursorIndex(target);
                setTotalTypedChars((prev) => prev + advanced);
                setWrongChars((prev) => {
                    if (prev.size === 0) return prev;
                    const next = new Set(prev);
                    for (let offset = index; offset < target; offset += 1) {
                        next.delete(offset);
                    }
                    return next;
                });
                return { advanced, nextIndex: target };
            };

            if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                reset();
                return;
            }

            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "enter") {
                e.preventDefault();
                e.stopPropagation();
                reset();
                return;
            }

            if (e.key === "Tab") {
                e.preventDefault();
                e.stopPropagation();
                const timestamp = Date.now();

                if (phaseNow === "finished") {
                    return;
                }

                if (phaseNow === "idle" || phaseNow === "countdown") {
                    setPhase("running");
                    setCountdown(null);
                    phaseNow = "running";
                }

                if (!startTime) {
                    setStartTime(timestamp);
                    setNow(timestamp);
                }

                const { nextIndex: currentIndex } = autoAdvanceIndentationIfAllowed(cursorIndex);
                const content = snippet.content;
                if (currentIndex >= content.length) {
                    return;
                }

                let advanced = 0;
                while (
                    advanced < INDENT_WIDTH &&
                    currentIndex + advanced < content.length &&
                    content[currentIndex + advanced] === " "
                ) {
                    advanced += 1;
                }

                if (advanced > 0) {
                    setCursorIndex((i) => i + advanced);
                    setTotalTypedChars((prev) => prev + advanced);
                    setWrongChars((prev) => {
                        if (prev.size === 0) return prev;
                        const next = new Set(prev);
                        for (let offset = 0; offset < advanced; offset += 1) {
                            next.delete(currentIndex + offset);
                        }
                        return next;
                    });
                    return;
                }

                const expected = content[currentIndex];
                if (expected === "\t") {
                    setCursorIndex((i) => i + 1);
                    setTotalTypedChars((prev) => prev + 1);
                    setWrongChars((prev) => {
                        if (!prev.has(currentIndex)) return prev;
                        const next = new Set(prev);
                        next.delete(currentIndex);
                        return next;
                    });
                }
                return;
            }

            const actionable = e.key === "Backspace" || e.key === "Enter" || e.key.length === 1;
            if (!actionable) return;

            const timestamp = Date.now();

            if (phaseNow === "finished" && e.key !== "Backspace") {
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            if (phaseNow === "idle" || phaseNow === "countdown") {
                setPhase("running");
                setCountdown(null);
                phaseNow = "running";
            }

            if (e.key === "Backspace") {
                if (phaseNow === "finished") {
                    setPhase("running");
                    phaseNow = "running";
                }
                e.preventDefault();
                e.stopPropagation();
                if (cursorIndex === 0) return;
                if (!startTime) {
                    setStartTime(timestamp);
                    setNow(timestamp);
                }
                const targetIndex = cursorIndex - 1;
                setCursorIndex((i) => Math.max(0, i - 1));
                setWrongChars((prev) => {
                    const next = new Set(prev);
                    next.delete(targetIndex);
                    return next;
                });
                return;
            }

            const { nextIndex: currentIndex } = autoAdvanceIndentationIfAllowed(cursorIndex);
            const expected = snippet.content[currentIndex];
            if (expected === undefined) return;

            if (!startTime) {
                setStartTime(timestamp);
                setNow(timestamp);
            }

            e.preventDefault();
            e.stopPropagation();

            const got = e.key === "Enter" ? "\n" : e.key;
            const ok = normalizeWhitespace(got) === normalizeWhitespace(expected);

            setCursorIndex((i) => i + 1);
            setTotalTypedChars((prev) => prev + 1);

            if (ok) {
                setWrongChars((prev) => {
                    if (!prev.has(currentIndex)) return prev;
                    const next = new Set(prev);
                    next.delete(currentIndex);
                    return next;
                });
            } else {
                setWrongChars((prev) => new Set(prev).add(currentIndex));
                setLastErrorAt(timestamp);
                setNow(timestamp);
                setErrorLog((prev) => {
                    const next = [...prev, { expected, got, index: currentIndex }];
                    if (next.length > 200) next.shift();
                    return next;
                });
            }
        }
        function onPaste(e: ClipboardEvent) {
            e.preventDefault();
        }
        function onBlur() {
            if (!allowEditorFocusRef.current) return;
            window.setTimeout(() => focusEditorRef.current?.(), 0);
        }
        function onFocus() {
            if (!allowEditorFocusRef.current) return;
            focusEditorRef.current?.();
        }
        // Use document for keyboard events to capture earlier, especially on macOS
        document.addEventListener("keydown", onKeyDown, true);
        window.addEventListener("paste", onPaste);
        window.addEventListener("blur", onBlur);
        window.addEventListener("focus", onFocus);
        return () => {
            document.removeEventListener("keydown", onKeyDown, true);
            window.removeEventListener("paste", onPaste);
            window.removeEventListener("blur", onBlur);
            window.removeEventListener("focus", onFocus);
        };
    }, [
        cursorIndex,
        snippet.content,
        startTime,
        reset,
        preferences.showLiveStatsDuringRun,
        preferences.requireTabForIndent,
        setShowLiveStatsDuringRun,
        handleNextProblem,
        enableEditorFocus,
        handleStartClick,
    ]);

    useEffect(() => {
        if (cursorIndex >= total && phase === "running") setPhase("finished");
    }, [cursorIndex, total, phase]);

    useEffect(() => {
        if (!countdownEnabled && phase === "countdown") {
            setCountdown(null);
            setPhase("running");
        }
    }, [countdownEnabled, phase]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (phase !== "running") return;
        const suppressUntil = suppressAutoScrollUntilRef.current;
        if (suppressUntil && Date.now() < suppressUntil) {
            return;
        }
        if (suppressUntil && Date.now() >= suppressUntil) {
            suppressAutoScrollUntilRef.current = null;
        }
        if (skipNextAutoScrollRef.current) {
            skipNextAutoScrollRef.current = false;
            return;
        }
        const rafId = window.requestAnimationFrame(() => {
            const caret = document.querySelector<HTMLElement>(".cs-caret");
            if (!caret) return;
            const rect = caret.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const behavior: ScrollBehavior = prefersReducedMotion ? "auto" : "smooth";
            const topBand = viewportHeight * 0.2;
            const bottomBand = viewportHeight * 0.75;
            const scrollElement = document.scrollingElement ?? document.documentElement ?? document.body;

            if (rect.bottom > bottomBand) {
                const delta = rect.bottom - bottomBand + 32;
                const maxDown =
                    scrollElement && viewportHeight
                        ? Math.max(0, scrollElement.scrollHeight - viewportHeight - window.scrollY)
                        : delta;
                const applied = Math.min(delta, maxDown);
                if (applied !== 0) {
                    window.scrollBy({ top: applied, behavior });
                }
                return;
            }

            if (rect.top < topBand && window.scrollY > 0) {
                const maxUp = -window.scrollY;
                const delta = Math.max(maxUp, rect.top - topBand - 32);
                if (delta !== 0) {
                    window.scrollBy({ top: delta, behavior });
                }
            }
        });
        return () => {
            if (rafId !== null) {
                window.cancelAnimationFrame(rafId);
            }
        };
    }, [cursorIndex, phase, prefersReducedMotion]);

    const elapsedMs = startTime ? now - startTime : 0;
    const outstandingErrors = wrongChars.size;
    const correct = Math.max(0, cursorIndex - outstandingErrors);
    const typed = totalTypedChars;
    const { adjustedWpm, acc } = computeMetrics({
        correctProgress: correct,
        elapsedMs,
        totalTyped: typed,
        errors: outstandingErrors,
    });
    const progress = total === 0 ? 0 : Math.min(1, cursorIndex / total);
    const progressPercent = Math.round(progress * 100);
    const caretErrorActive = lastErrorAt !== null && now >= lastErrorAt && now - lastErrorAt < 600;
    const focusActive = phase === "running";
    const finalWpm = adjustedWpm;
    const showLiveStatsPanel = phase === "finished" && preferences.showLiveStatsDuringRun;
    const liveStatsWpmValue = finalWpm;
    const showChrome = isTerminalMode ? true : !focusActive;

    useEffect(() => {
        if (typeof document === "undefined") return;
        const body = document.body;
        if (!body) return;
        if (phase === "running") {
            body.classList.add("cs-focus-active");
        } else {
            body.classList.remove("cs-focus-active");
        }
        return () => {
            body.classList.remove("cs-focus-active");
        };
    }, [phase]);

    useEffect(() => {
        reset({ skipFocus: !allowEditorFocusRef.current });
    }, [snippet.id, reset]);

    useEffect(() => {
        if (phase !== "finished") {
            cancelAutoAdvance();
            return;
        }
        cancelAutoAdvance();
        const delayMs = 3000;
        const deadline = Date.now() + delayMs;
        setAutoAdvanceDeadline(deadline);
        const timeoutId = window.setTimeout(() => {
            if (autoAdvanceTimeoutRef.current === timeoutId) {
                autoAdvanceTimeoutRef.current = null;
            }
            setAutoAdvanceDeadline(null);
            handleNextProblem();
        }, delayMs);
        autoAdvanceTimeoutRef.current = timeoutId;
        return () => {
            window.clearTimeout(timeoutId);
            if (autoAdvanceTimeoutRef.current === timeoutId) {
                autoAdvanceTimeoutRef.current = null;
            }
        };
    }, [phase, handleNextProblem, cancelAutoAdvance]);

    const controlsMotion: MotionProps = prefersReducedMotion
        ? {}
        : {
            variants: FADE_IN_UP,
            initial: "hidden",
            animate: "visible",
            transition: { ...SPRING_SMOOTH, stiffness: 280, damping: 30 },
        };

    const startButtonMotion: MotionProps = prefersReducedMotion
        ? {}
        : {
            initial: { opacity: 0, scale: 0.92 },
            animate: { opacity: 1, scale: 1 },
            exit: { opacity: 0, scale: 0.88 },
            whileHover: { scale: 1.03 },
            whileTap: { scale: 0.97 },
            transition: { duration: MOTION_DURATION.quick, ease: MOTION_EASE.out },
        };

    const resultCardMotion: MotionProps = prefersReducedMotion
        ? {}
        : {
            variants: POP_IN,
            initial: "hidden",
            animate: "visible",
            exit: "exit",
            transition: { ...SPRING_SMOOTH, stiffness: 260, damping: 28 },
        };

    const panelMotion: MotionProps = prefersReducedMotion
        ? {}
        : {
            variants: POP_IN,
            initial: "hidden",
            animate: "visible",
            transition: { ...SPRING_SMOOTH, stiffness: 220, damping: 24 },
        };

    const surface = "var(--surface)";
    const surfaceHover = "var(--surface-hover)";
    const surfaceActive = "var(--surface-active)";
    const panelGlass = "var(--panel-glass)";
    const border = "var(--border)";
    const borderStrong = "var(--border-strong)";
    const text = "var(--text)";
    const textSubtle = "var(--text-subtle)";
    const accent = "var(--accent)";
    const panelMaxWidth = "100%";

    const pillButtonStyles = (active: boolean): Partial<ButtonProps> =>
        isTerminalMode
            ? {
                size: "sm",
                borderRadius: "8px",
                px: 3,
                py: 2,
                bg: active ? surfaceActive : surface,
                color: active ? accent : textSubtle,
                border: "1px solid",
                borderColor: active ? borderStrong : border,
                fontFamily: '"IBM Plex Mono", "JetBrains Mono", "Fira Code", "SFMono-Regular", Menlo, Consolas, Monaco, monospace',
                letterSpacing: "0.08em",
                transition: "all 0.18s ease",
                _hover: { bg: surfaceHover, color: accent },
                _active: { bg: surfaceActive },
            }
            : {
                size: "sm",
                borderRadius: "0",
                px: 3,
                py: 1.5,
                bg: "transparent",
                color: active ? accent : textSubtle,
                border: "none",
                fontWeight: active ? 500 : 400,
                transition: "color 0.15s ease",
                _hover: { bg: "transparent", color: accent },
                _active: { bg: "transparent" },
            };

    const layoutGap = isTerminalMode ? 4 : isImmersive ? 4 : 6;
    const safeProgress = Number.isFinite(progress) ? progress : 0;
    const terminalBarWidth = 24;
    const terminalFilled = Math.min(terminalBarWidth, Math.max(0, Math.round(safeProgress * terminalBarWidth)));
    const terminalBar = "█".repeat(terminalFilled) + "░".repeat(terminalBarWidth - terminalFilled);
    const terminalProgressText = `[${terminalBar}] ${progressPercent.toString().padStart(3, " ")}%`;
    const progressIndicator = !showChrome
        ? null
        : isTerminalMode
            ? (
                <Box
                    border="1px solid var(--border)"
                    borderRadius="md"
                    bg={panelGlass}
                    px={4}
                    py={2}
                    fontFamily='"IBM Plex Mono", "JetBrains Mono", "Fira Code", "SFMono-Regular", Menlo, Consolas, Monaco, monospace'
                    fontSize="sm"
                    letterSpacing="0.08em"
                    color={accent}
                >
                    {terminalProgressText}
                </Box>
            )
            : isImmersive
                ? null
                : (
                    <Box borderRadius="full" bg={surface} h="6px" overflow="hidden" w="100%" maxW="360px">
                        <motion.div
                            initial={false}
                            animate={{ scaleX: progress }}
                            transition={
                                prefersReducedMotion ? { duration: 0.01 } : { type: "spring", stiffness: 210, damping: 28, mass: 0.45 }
                            }
                            style={{
                                height: "100%",
                                width: "100%",
                                background: "linear-gradient(90deg, var(--accent) 0%, transparent 100%)",
                                borderRadius: "inherit",
                                transformOrigin: "0% 50%",
                            }}
                        />
                    </Box>
                );

    const currentProblemIndex = problemOptions.findIndex((problem) => problem.id === problemId);
    const currentProblem: Problem | null = currentProblemIndex >= 0 ? problemOptions[currentProblemIndex] : null;
    const problemCount = problemOptions.length;
    const nextProblemButtonStyles: Partial<ButtonProps> = isTerminalMode
        ? {
            size: "sm",
            borderRadius: "8px",
            px: 3,
            py: 2,
            fontFamily: '"IBM Plex Mono", "JetBrains Mono", "Fira Code", "SFMono-Regular", Menlo, Consolas, Monaco, monospace',
            bg: surface,
            color: accent,
            border: "1px solid",
            borderColor: borderStrong,
            letterSpacing: "0.08em",
            _hover: { bg: surfaceHover },
            _active: { bg: surfaceActive },
        }
        : {
            size: "sm",
            borderRadius: "full",
            px: 4,
            py: 2,
            bg: accent,
            color: "#141414",
            fontWeight: 600,
            _hover: { bg: "#ffd65a" },
            _active: { bg: "#fcbf2c" },
        };

    const nextProblemButton =
        problemCount > 1
            ? (
                <Button
                    onClick={handleNextProblem}
                    title="Next problem (press N)"
                    {...nextProblemButtonStyles}
                >
                    Next problem
                </Button>
            )
            : null;

    const problemSummary =
        problemCount > 0 ? (
            <Flex direction="column" gap={1} minW={0}>
                <Text fontSize="sm" fontWeight={600} color={text} whiteSpace="nowrap">
                    {problemCount} {problemCount === 1 ? "problem" : "problems"}
                </Text>
                <Text fontSize="xs" color={textSubtle} whiteSpace="nowrap" textOverflow="ellipsis" overflow="hidden">
                    Now practicing: {currentProblem ? currentProblem.title : "Random snippet"} • Cycle with N
                </Text>
            </Flex>
        ) : (
            <Text fontSize="sm" fontWeight={600} color={text}>
                No problems available
            </Text>
        );

    const hasMeta = Boolean(progressIndicator || problemSummary);
    const hasActions = Boolean(nextProblemButton);
    const sessionTopBar = hasMeta || hasActions
        ? (
            <Flex
                align="center"
                justify={hasMeta && hasActions ? "space-between" : "flex-start"}
                gap={3}
                flexWrap="wrap"
            >
                {hasMeta ? (
                    <Flex align="center" gap={3} flexWrap="wrap">
                        {progressIndicator}
                        {problemSummary}
                    </Flex>
                ) : null}
                {hasActions ? (
                    <Flex align="center" gap={2} flexWrap="wrap" ml={hasMeta ? undefined : "auto"}>
                        {nextProblemButton}
                    </Flex>
                ) : null}
            </Flex>
        )
        : null;

    const languageOptions: Array<{ value: typeof lang; label: string }> = [
        { value: "javascript", label: "JavaScript" },
        { value: "python", label: "Python" },
        { value: "java", label: "Java" },
        { value: "cpp", label: "C++" },
    ];

    const lengthOptions: Array<{ value: LengthFilter; label: string; helper: string }> = [
        { value: "all", label: "All", helper: "any length" },
        { value: "short", label: "Short", helper: "under ~15 lines" },
        { value: "medium", label: "Medium", helper: "tight 15–40 lines" },
        { value: "long", label: "Long", helper: "extended 40+ lines" },
    ];

    const surfaceOptions: Array<{ value: typeof storedSurfaceStyle; label: string }> = [
        { value: "panel", label: "Framed" },
        { value: "immersive", label: "Immersive" },
    ];


    const startButtonStyles: Partial<ButtonProps> = isTerminalMode
        ? {
            size: "sm",
            borderRadius: "8px",
            px: 4,
            py: 2,
            fontFamily: '"IBM Plex Mono", "JetBrains Mono", "Fira Code", "SFMono-Regular", Menlo, Consolas, Monaco, monospace',
            bg: surface,
            color: accent,
            border: "1px solid",
            borderColor: borderStrong,
            letterSpacing: "0.08em",
            _hover: { bg: surfaceHover },
            _active: { bg: surfaceActive },
        }
        : {
            size: "sm",
            borderRadius: "0",
            px: 3,
            py: 1.5,
            bg: "transparent",
            color: textSubtle,
            fontWeight: 400,
            _hover: { bg: "transparent", color: accent },
            _active: { bg: "transparent" },
        };

    return (
        <Box display="flex" flexDirection="column" gap={8}>
            {!focusActive && (
                <motion.div
                    style={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: "8px",
                        padding: "6px 12px",
                        borderRadius: "8px",
                        background: panelGlass,
                        backdropFilter: "blur(12px)",
                        border: `1px solid ${border}`,
                        boxShadow: "var(--shadow)",
                        flexWrap: "wrap",
                    }}
                    {...controlsMotion}
                    layout
                >
                    <Flex gap={2} flexWrap="wrap" align="center">
                        {languageOptions.map((option) => (
                            <Button
                                key={option.value}
                                {...pillButtonStyles(lang === option.value)}
                                onClick={() => setLang(option.value)}
                                disabled={controlsDisabled}
                            >
                                {option.label}
                            </Button>
                        ))}
                    </Flex>
                    <Flex gap={2} flexWrap="wrap" align="center" ml={2}>
                        {lengthOptions.map((option) => (
                            <Button
                                key={option.value}
                                title={option.helper}
                                {...pillButtonStyles(lengthPref === option.value)}
                                onClick={() => setLengthPref(option.value)}
                                disabled={controlsDisabled}
                            >
                                {option.label}
                            </Button>
                        ))}
                    </Flex>
                    <Flex gap={2} flexWrap="wrap" align="center" ml="auto">
                        {surfaceOptions.map((option) => (
                            <Button
                                key={option.value}
                                {...pillButtonStyles(storedSurfaceStyle === option.value)}
                                onClick={() => persistSurfaceStyle(option.value)}
                                disabled={controlsDisabled}
                            >
                                {option.label}
                            </Button>
                        ))}
                    </Flex>
                    <AnimatePresence>
                        {phase === "idle" && (
                            <motion.div {...startButtonMotion} layout style={{ display: "inline-flex" }}>
                                <Button
                                    onClick={handleStartClick}
                                    {...startButtonStyles}
                                >
                                    Start
                                </Button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            )}

            <Stack w="100%" gap={layoutGap} align="center">
                <Box w="100%" position="relative">
                    <motion.div
                        ref={panelContainerRef}
                        key={`${snippet.id}-${lang}-${lengthPref}`}
                        {...panelMotion}
                        layout
                        style={{ display: "flex", justifyContent: "center", width: "100%" }}
                    >
                        <Box display="flex" flexDirection="column" gap={4} maxW={panelMaxWidth} mx="auto" w="100%">
                            {sessionTopBar}
                            <CodePanel
                                content={snippet.content}
                                cursorChar={cursorIndex}
                                wrongChars={wrongChars}
                                language={lang === "javascript" ? "javascript" : lang}
                                caretErrorActive={caretErrorActive}
                                onReady={handleEditorReady}
                                fontSize={editorFontSize}
                                surfaceStyle={effectiveSurfaceStyle}
                                syntaxHighlightingEnabled={preferences.syntaxHighlightingEnabled}
                            />
                        </Box>
                    </motion.div>
                    <AnimatePresence mode="wait">
                        {isCountingDown && countdown !== null && (
                            <motion.div
                                key="countdown-overlay"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: MOTION_DURATION.quick, ease: MOTION_EASE.inOut }}
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    background: prefersReducedMotion ? "transparent" : "var(--overlay)",
                                    backdropFilter: prefersReducedMotion ? undefined : "blur(10px)",
                                }}
                            >
                                <AnimatePresence mode="wait">
                                    <motion.span
                                        key={countdown}
                                        initial={{ opacity: 0, scale: 0.6 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.85 }}
                                        transition={{ duration: MOTION_DURATION.quick, ease: MOTION_EASE.out }}
                                        style={{
                                            fontSize: "4rem",
                                            fontWeight: 700,
                                            color: "var(--text)",
                                            textShadow: "0 12px 34px color-mix(in srgb, var(--bg) 40%, transparent)",
                                        }}
                                    >
                                        {countdown === 0 ? "Go" : countdown}
                                    </motion.span>
                                </AnimatePresence>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Box>
            </Stack>

            <AnimatePresence mode="wait">
                {finished && (
                    <motion.div style={{ marginTop: 16 }} {...resultCardMotion} layout>
                        <Stack gap={5} align="center">
                            {showLiveStatsPanel ? <LiveStats wpm={liveStatsWpmValue} acc={acc} label="Final WPM" /> : null}
                            <ResultCard
                                wpm={finalWpm}
                                acc={acc}
                                timeMs={elapsedMs}
                                errors={outstandingErrors}
                                onReplay={reset}
                                onNext={problemOptions.length > 1 ? handleNextProblem : undefined}
                                autoAdvanceDeadline={autoAdvanceDeadline}
                                snippetTitle={snippet.title}
                                snippetId={snippet.id}
                                lang={lang}
                                difficulty={snippet.difficulty}
                                lengthCategory={snippet.lengthCategory}
                                errorLog={errorLog}
                            />
                        </Stack>
                    </motion.div>
                )}
            </AnimatePresence>
        </Box>
    );
}
