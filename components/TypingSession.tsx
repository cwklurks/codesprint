"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Button, Flex, Stack, Text } from "@chakra-ui/react";
import type { ButtonProps } from "@chakra-ui/react";
import { AnimatePresence, motion } from "framer-motion";
import {
    TooltipContent,
    TooltipPositioner,
    TooltipRoot,
    TooltipTrigger,
} from "@chakra-ui/react";
import CodePanel from "@/components/CodePanel";
import LiveStats from "@/components/LiveStats";
import ResultCard from "@/components/ResultCard";
import { getProblemSnippets, getProblems, getSnippet, type Problem, type Snippet, type SnippetLength } from "@/lib/snippets";
import { FADE_IN_UP, MOTION_DURATION, MOTION_EASE, POP_IN, SPRING_SMOOTH, usePrefersReducedMotion } from "@/lib/motion";
import { usePreferences } from "@/lib/preferences";
import type { MotionProps } from "framer-motion";
import { useTypingEngine } from "@/hooks/useTypingEngine";
import { useAutoScroll } from "@/hooks/useAutoScroll";

type LengthFilter = SnippetLength | "all";

export default function TypingSession() {
    const [lang, setLang] = useState<"python" | "javascript" | "java" | "cpp">("javascript");
    const [lengthPref, setLengthPref] = useState<LengthFilter>("all");
    
    // Problem & Snippet Selection
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

    // Preferences
    const { preferences, setSurfaceStyle: persistSurfaceStyle, setShowLiveStatsDuringRun } = usePreferences();
    const editorFontSize = preferences.fontSize;
    const storedSurfaceStyle = preferences.surfaceStyle ?? "panel";
    const interfaceMode = preferences.interfaceMode;
    const isTerminalMode = interfaceMode === "terminal";
    const effectiveSurfaceStyle = isTerminalMode ? "immersive" : storedSurfaceStyle;
    const isImmersive = effectiveSurfaceStyle === "immersive";
    const prefersReducedMotion = usePrefersReducedMotion();

    // Auto-advance state
    const [autoAdvanceDeadline, setAutoAdvanceDeadline] = useState<number | null>(null);
    const autoAdvanceTimeoutRef = useRef<number | null>(null);

    const handleNextProblem = useCallback(() => {
        if (autoAdvanceTimeoutRef.current !== null) {
            window.clearTimeout(autoAdvanceTimeoutRef.current);
            autoAdvanceTimeoutRef.current = null;
        }
        setAutoAdvanceDeadline(null);
        
        if (problemOptions.length === 0) return;
        
        const currentIndex = problemOptions.findIndex((problem) => problem.id === problemId);
        const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % problemOptions.length : 0;
        const nextProblem = problemOptions[nextIndex];
        setProblemId(nextProblem.id);
    }, [problemId, problemOptions]);

    // Typing Engine
    const {
        phase,
        countdown,
        cursorIndex,
        wrongChars,
        metrics,
        elapsedMs,
        errorLog,
        caretErrorActive,
        reset: resetEngine,
        start: startEngine,
        handleKeyDown: engineHandleKeyDown,
    } = useTypingEngine({
        snippet,
        onFinish: () => {
            // Schedule auto-advance
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
        }
    });

    // Reset engine when snippet changes
    useEffect(() => {
        resetEngine();
        if (autoAdvanceTimeoutRef.current !== null) {
            window.clearTimeout(autoAdvanceTimeoutRef.current);
            autoAdvanceTimeoutRef.current = null;
        }
        setAutoAdvanceDeadline(null);
    }, [snippet.id, resetEngine]);

    // Focus Management
    const focusEditorRef = useRef<(() => void) | null>(null);
    const allowEditorFocusRef = useRef(false);
    const panelContainerRef = useRef<HTMLDivElement | null>(null);

    const handleEditorReady = useCallback((focus: () => void) => {
        focusEditorRef.current = focus;
        if (allowEditorFocusRef.current) {
            focus();
        }
    }, []);

    const enableEditorFocus = useCallback(() => {
        allowEditorFocusRef.current = true;
    }, []);

    // Auto Scroll
    useAutoScroll({
        cursorIndex,
        phase,
        containerRef: panelContainerRef,
        enabled: true,
    });

    // Global Shortcuts & Event Listeners
    useEffect(() => {
        function onKeyDown(e: KeyboardEvent) {
            const keyLower = e.key.toLowerCase();
            
            // Global shortcuts
            if (!e.metaKey && !e.ctrlKey && !e.altKey) {
                if (e.key === "Escape" && (phase === "running" || phase === "countdown")) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (autoAdvanceTimeoutRef.current !== null) {
                        window.clearTimeout(autoAdvanceTimeoutRef.current);
                        autoAdvanceTimeoutRef.current = null;
                    }
                    setAutoAdvanceDeadline(null);
                    resetEngine();
                    return;
                }
                if (keyLower === "r" && phase !== "running") {
                    e.preventDefault();
                    e.stopPropagation();
                    enableEditorFocus();
                    resetEngine();
                    startEngine();
                    focusEditorRef.current?.();
                    return;
                }
                if (keyLower === "n" && phase !== "running") {
                    e.preventDefault();
                    e.stopPropagation();
                    enableEditorFocus();
                    handleNextProblem();
                    return;
                }
                if (keyLower === "l") {
                    if (phase !== "running") {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowLiveStatsDuringRun(!preferences.showLiveStatsDuringRun);
                        return;
                    }
                }
            }

            // Pass to engine
            enableEditorFocus();
            engineHandleKeyDown(e);
        }

        function onPaste(e: ClipboardEvent) {
            e.preventDefault();
        }

        function onBlur() {
            if (!allowEditorFocusRef.current) return;
            // Re-focus on next tick to keep focus trapped if desired, 
            // but for now just a simple re-focus attempt
            window.setTimeout(() => focusEditorRef.current?.(), 0);
        }

        function onFocus() {
            if (!allowEditorFocusRef.current) return;
            focusEditorRef.current?.();
        }

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
        phase,
        preferences.showLiveStatsDuringRun,
        setShowLiveStatsDuringRun,
        handleNextProblem,
        enableEditorFocus,
        resetEngine,
        startEngine,
        engineHandleKeyDown,
    ]);

    // Focus Mode (Body Class)
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

    // Derived UI State
    const started = phase === "running";
    const finished = phase === "finished";
    const isCountingDown = phase === "countdown";
    const controlsDisabled = started || isCountingDown;
    const showLiveStatsPanel = phase === "finished" && preferences.showLiveStatsDuringRun;
    const focusActive = phase === "running";
    const showChrome = isTerminalMode ? true : !focusActive;

    const total = snippet.content.length;
    const progress = total === 0 ? 0 : Math.min(1, cursorIndex / total);
    const progressPercent = Math.round(progress * 100);

    // UI Components
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

    // Styles
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
    
    // Terminal Progress Bar
    const terminalBarWidth = 24;
    const terminalFilled = Math.min(terminalBarWidth, Math.max(0, Math.round(progress * terminalBarWidth)));
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
                <TooltipRoot>
                    <TooltipTrigger asChild>
                        <Button
                            onClick={() => {
                                enableEditorFocus();
                                handleNextProblem();
                            }}
                            {...nextProblemButtonStyles}
                        >
                            Next problem
                        </Button>
                    </TooltipTrigger>
                    <TooltipPositioner>
                        <TooltipContent
                            bg="var(--surface)"
                            color="var(--text)"
                            border="1px solid var(--border)"
                            fontSize="xs"
                            px={2}
                            py={1}
                        >
                            Press N
                        </TooltipContent>
                    </TooltipPositioner>
                </TooltipRoot>
            )
            : null;

    const problemSummary =
        problemCount > 0 ? (
            <Flex direction="column" gap={1} minW={0}>
                <Text fontSize="sm" fontWeight={600} color={text} whiteSpace="nowrap">
                    {problemCount} {problemCount === 1 ? "problem" : "problems"}
                </Text>
                <Text fontSize="xs" color={textSubtle} whiteSpace="nowrap" textOverflow="ellipsis" overflow="hidden">
                    Now practicing: {currentProblem ? currentProblem.title : "Random snippet"}
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
                            <TooltipRoot key={option.value}>
                                <TooltipTrigger asChild>
                                    <Button
                                        {...pillButtonStyles(lengthPref === option.value)}
                                        onClick={() => setLengthPref(option.value)}
                                        disabled={controlsDisabled}
                                    >
                                        {option.label}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipPositioner>
                                    <TooltipContent
                                        bg="var(--surface)"
                                        color="var(--text)"
                                        border="1px solid var(--border)"
                                        fontSize="xs"
                                        px={2}
                                        py={1}
                                    >
                                        {option.helper}
                                    </TooltipContent>
                                </TooltipPositioner>
                            </TooltipRoot>
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
                                    onClick={() => {
                                        enableEditorFocus();
                                        startEngine();
                                        focusEditorRef.current?.();
                                    }}
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
                            {showLiveStatsPanel ? <LiveStats wpm={metrics.adjustedWpm} acc={metrics.acc} label="Final WPM" /> : null}
                            <ResultCard
                                wpm={metrics.adjustedWpm}
                                acc={metrics.acc}
                                timeMs={elapsedMs}
                                errors={wrongChars.size}
                                onReplay={() => {
                                    enableEditorFocus();
                                    resetEngine();
                                    focusEditorRef.current?.();
                                }}
                                onNext={problemOptions.length > 1 ? () => {
                                    enableEditorFocus();
                                    handleNextProblem();
                                } : undefined}
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
