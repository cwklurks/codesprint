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
import dynamic from "next/dynamic";
import GapBufferVisualizer from "@/components/GapBufferVisualizer";
import LiveStats from "@/components/LiveStats";
import ResultCard from "@/components/ResultCard";
import { getProblemSnippets, getProblems, getSnippet, type Problem, type Snippet, type SnippetLength, type SupportedLanguage } from "@/lib/snippets";
import { FADE_IN_UP, MOTION_DURATION, MOTION_EASE, POP_IN, SPRING_SMOOTH, usePrefersReducedMotion } from "@/lib/motion";
import { usePreferences } from "@/lib/preferences";
import type { MotionProps } from "framer-motion";
import { useTypingEngine } from "@/hooks/useTypingEngine";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { useSnippets } from "@/hooks/useSnippets";
import { saveScore } from "@/lib/leaderboard";
import LeaderboardModal from "@/components/LeaderboardModal";

const CodePanel = dynamic(() => import("@/components/CodePanel"), {
    ssr: false,
    loading: () => <Box h="400px" bg="var(--panel)" borderRadius="md" />,
});

type LengthFilter = SnippetLength | "all";

export default function TypingSession() {
    const [language, setLanguage] = useState<SupportedLanguage>("python");
    const [lengthPreference, setLengthPreference] = useState<LengthFilter>("short");
    // Pass current language to load that language's snippets first (fast), then others in background
    const { snippets } = useSnippets(language);
    const [isVimPreviewing, setIsVimPreviewing] = useState(false);
    const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);

    // Problem & Snippet Selection
    const problemOptions = useMemo<Problem[]>(() => {
        const options = getProblems(snippets, language, lengthPreference === "all" ? undefined : { length: lengthPreference });
        return options;
    }, [language, lengthPreference, snippets]);

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
        const options = getProblemSnippets(snippets, language, problemId, lengthPreference === "all" ? undefined : { length: lengthPreference });
        return options;
    }, [language, problemId, lengthPreference, snippets]);

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
            const filters = lengthPreference === "all" ? undefined : { length: lengthPreference };
            return getSnippet(snippets, language, filters);
        }
        const selected = snippetOptions.find((option) => option.id === snippetId);
        return selected ?? snippetOptions[0];
    }, [snippetOptions, snippetId, language, lengthPreference, snippets]);

    // Preferences
    const { preferences, setSurfaceStyle: persistSurfaceStyle, setShowLiveStatsDuringRun, setVimMode } = usePreferences();
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
        history,
    } = useTypingEngine({
        snippet,
    });

    const handleNextProblem = useCallback(() => {
        console.log("handleNextProblem called");
        if (autoAdvanceTimeoutRef.current !== null) {
            window.clearTimeout(autoAdvanceTimeoutRef.current);
            autoAdvanceTimeoutRef.current = null;
        }
        setAutoAdvanceDeadline(null);

        if (problemOptions.length === 0) {
            console.log("No problem options");
            return;
        }

        const currentIndex = problemOptions.findIndex((problem) => problem.id === problemId);
        console.log("Current index:", currentIndex, "Problem ID:", problemId);
        const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % problemOptions.length : 0;
        const nextProblem = problemOptions[nextIndex];
        console.log("Next problem:", nextProblem.id);

        // Explicitly reset engine state
        console.log("Calling resetEngine");
        resetEngine();
        setProblemId(nextProblem.id);
    }, [problemId, problemOptions, resetEngine]);

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

    const beginVimPreview = useCallback(() => {
        if (!preferences.vimMode) {
            setVimMode(true);
        }
        setIsVimPreviewing(true);
        enableEditorFocus();
        setTimeout(() => focusEditorRef.current?.(), 40);
    }, [enableEditorFocus, preferences.vimMode, setVimMode]);

    const exitVimPreview = useCallback(() => {
        setIsVimPreviewing(false);
    }, []);

    // Global Shortcuts & Event Listeners
    useEffect(() => {
        function onKeyDown(e: KeyboardEvent) {
            const allowVimHandling = preferences.vimMode;
            const keyLower = e.key.toLowerCase();

            // 1. Global Escape Handling (Highest Priority)
            if (e.key === "Escape") {
                if (isVimPreviewing) {
                    e.preventDefault();
                    e.stopPropagation();
                    setVimMode(false);
                    exitVimPreview();
                    return;
                }
                if (phase === "finished" && problemOptions.length > 1) {
                    e.preventDefault();
                    e.stopPropagation();
                    enableEditorFocus();
                    handleNextProblem();
                    return;
                }
                if (phase === "running" || phase === "countdown") {
                    if (autoAdvanceTimeoutRef.current !== null) {
                        window.clearTimeout(autoAdvanceTimeoutRef.current);
                        autoAdvanceTimeoutRef.current = null;
                    }
                    setAutoAdvanceDeadline(null);
                    resetEngine();

                    // If Vim mode is enabled, go back to preview instead of just resetting
                    if (preferences.vimMode) {
                        beginVimPreview();
                        // Allow propagation so monaco-vim sees Esc and exits Insert mode
                        return;
                    }

                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
            }

            // 2. Vim Toggle (v) - Allow toggling ON/OFF when not running
            if (!e.metaKey && !e.ctrlKey && !e.altKey && keyLower === "v" && phase !== "running") {
                e.preventDefault();
                e.stopPropagation();
                if (isVimPreviewing || preferences.vimMode) {
                    setVimMode(false);
                    exitVimPreview();
                } else {
                    beginVimPreview();
                }
                return;
            }

            // 3. Vim Preview Mode - Delegate to Monaco, ignore Engine
            if (isVimPreviewing) {
                // In preview mode, we let events bubble to Monaco (Vim)
                // We capture specific navigation keys if needed, but mostly we just want to avoid starting the engine
                // or logging errors.

                // Handle 'i' to start typing
                if (keyLower === "i" && !e.metaKey && !e.ctrlKey && !e.altKey) {
                    // Allow propagation so monaco-vim enters Insert mode

                    setVimMode(true); // Ensure it's on
                    setIsVimPreviewing(false);
                    enableEditorFocus();
                    resetEngine();
                    startEngine();
                    focusEditorRef.current?.();
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
                        resetEngine();
                        startEngine();
                        focusEditorRef.current?.();
                        return;
                    }
                    if (keyLower === "n" || keyLower === "q") {
                        e.preventDefault();
                        e.stopPropagation();
                        // Keep vim mode? Or exit? Let's keep it for browsing next problem.
                        // But we need to reset engine state.
                        enableEditorFocus();
                        handleNextProblem();
                        return;
                    }
                }
                return;
            }

            // 4. Global Shortcuts (Non-Vim)
            if (!e.metaKey && !e.ctrlKey && !e.altKey) {
                // Handle Escape, Tab, and Space to go to next test when finished
                if (phase === "finished" && problemOptions.length > 1) {
                    if (e.key === "Tab" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        enableEditorFocus();
                        handleNextProblem();
                        return;
                    }
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
                if ((keyLower === "n" || keyLower === "q") && phase !== "running") {
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
                if (keyLower === "p" && phase !== "running") {
                    return;
                }
            }

            // 5. Pass to Engine (Typing)
            // Only if we are NOT in Vim Preview (already handled)
            // And if we are in Vim Mode (but not previewing), we still pass to engine?
            // If vimMode is true but !isVimPreviewing, it means we are "typing with vim mode enabled"?
            // But we just decided that 'v' toggles both.
            // So if vimMode is true, isVimPreviewing should be true?
            // Not necessarily. 'beginVimPreview' sets both.
            // But if user set vimMode in settings, isVimPreviewing is false initially.

            if (allowVimHandling) {
                // If vimMode is on but we are not in explicit preview, 
                // we assume the user wants to type.
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
        preferences.vimMode,
        setShowLiveStatsDuringRun,
        setVimMode,
        handleNextProblem,
        enableEditorFocus,
        resetEngine,
        startEngine,
        engineHandleKeyDown,
        beginVimPreview,
        exitVimPreview,
        isVimPreviewing,
        problemOptions,
    ]);

    useEffect(() => {
        if (phase === "running" && isVimPreviewing) {
            setIsVimPreviewing(false);
        }
    }, [phase, isVimPreviewing]);

    // Save score on finish
    useEffect(() => {
        if (phase === "finished") {
            saveScore({
                wpm: metrics.adjustedWpm,
                accuracy: metrics.accuracy,
                language,
                snippetId: snippet.id,
            });
        }
    }, [phase, metrics.adjustedWpm, metrics.accuracy, language, snippet.id]);

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
                            Press N or Q
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
    const showRunningStats = phase === "running" && preferences.showLiveStatsDuringRun;

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
                        <Button
                            size="sm"
                            variant="ghost"
                            color="var(--text-subtle)"
                            _hover={{ color: "var(--accent)", bg: "var(--surface-hover)" }}
                            onClick={() => setIsLeaderboardOpen(true)}
                        >
                            Leaderboard
                        </Button>
                        {nextProblemButton}
                    </Flex>
                ) : null}
            </Flex>
        )
        : null;

    const languageOptions: Array<{ value: SupportedLanguage; label: string }> = [
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
        <Box position="relative" minH="400px">
            <AnimatePresence mode="wait">
                {!finished ? (
                    <motion.div
                        key="session"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        style={{ width: "100%" }}
                    >
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
                                                {...pillButtonStyles(language === option.value)}
                                                onClick={() => setLanguage(option.value)}
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
                                                        {...pillButtonStyles(lengthPreference === option.value)}
                                                        onClick={() => setLengthPreference(option.value)}
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
                                        key={`${snippet.id}-${language}-${lengthPreference}`}
                                        {...panelMotion}
                                        layout
                                        style={{ display: "flex", justifyContent: "center", width: "100%" }}
                                    >
                                        <Box display="flex" flexDirection="column" gap={4} maxW={panelMaxWidth} mx="auto" w="100%">
                                            {sessionTopBar}
                                            {showRunningStats && (
                                                <Box alignSelf="center" width="100%" maxW="md">
                                                    <LiveStats wpm={metrics.adjustedWpm} accuracy={metrics.accuracy} />
                                                </Box>
                                            )}
                                            <CodePanel
                                                content={snippet.content}
                                                cursorChar={cursorIndex}
                                                wrongChars={wrongChars}
                                                language={language === "javascript" ? "javascript" : language}
                                                caretErrorActive={caretErrorActive}
                                                onReady={handleEditorReady}
                                                fontSize={editorFontSize}
                                                surfaceStyle={effectiveSurfaceStyle}
                                                syntaxHighlighting={preferences.syntaxHighlighting}
                                            />
                                            {preferences.debugGapBuffer && (
                                                <GapBufferVisualizer
                                                    content={snippet.content}
                                                    cursorIndex={cursorIndex}
                                                />
                                            )}
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
                        </Box>
                    </motion.div>
                ) : (
                    <motion.div
                        key="result"
                        {...resultCardMotion}
                        style={{ width: "100%", display: "flex", justifyContent: "center", marginTop: 32 }}
                    >
                        <Stack gap={5} align="center" w="100%" maxW="800px">
                            {showLiveStatsPanel ? <LiveStats wpm={metrics.adjustedWpm} accuracy={metrics.accuracy} label="Final WPM" /> : null}
                            <ResultCard
                                wpm={metrics.adjustedWpm}
                                accuracy={metrics.accuracy}
                                timeMs={elapsedMs}
                                errors={wrongChars.size}
                                onNext={problemOptions.length > 1 ? () => {
                                    enableEditorFocus();
                                    handleNextProblem();
                                } : undefined}
                                autoAdvanceDeadline={autoAdvanceDeadline}
                                snippetTitle={snippet.title}
                                snippetId={snippet.id}
                                language={language}
                                difficulty={snippet.difficulty}
                                lengthCategory={snippet.lengthCategory}
                                errorLog={errorLog}
                                history={history}
                            />
                        </Stack>
                    </motion.div>
                )}
            </AnimatePresence>
            <LeaderboardModal isOpen={isLeaderboardOpen} onOpenChange={(e) => setIsLeaderboardOpen(e.open)} />
        </Box>
    );
}
