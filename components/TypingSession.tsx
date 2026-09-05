"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Stack } from "@chakra-ui/react";
import { AnimatePresence, m } from "framer-motion";
import dynamic from "next/dynamic";

import GapBufferVisualizer from "@/components/GapBufferVisualizer";
import LiveStats from "@/components/LiveStats";

import { useOverlayState } from "@/components/AppShell";
import { SessionControlBar } from "@/components/session/SessionControlBar";
import { SessionTopBar } from "@/components/session/SessionTopBar";
import { CountdownOverlay } from "@/components/session/CountdownOverlay";
import { DailyChallengeCard } from "@/components/daily/DailyChallengeCard";

import { usePrefersReducedMotion } from "@/lib/motion";
import { usePreferences } from "@/lib/preferences";
import { getPanelMotion, getSessionSwapMotion } from "@/lib/motion-config";
import { getLayoutGap } from "@/lib/session-styles";
import { estimateEditorHeight } from "@/lib/code-panel";

import { useTypingEngine } from "@/hooks/useTypingEngine";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { useSnippets } from "@/hooks/useSnippets";
import { useFocusManagement, useFocusActiveClass } from "@/hooks/useFocusManagement";
import { useSessionLifecycle } from "@/hooks/useSessionLifecycle";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useSessionControls } from "@/hooks/useSessionControls";
import { useAchievements } from "@/hooks/useAchievements";
import { useSpacedRepetition } from "@/hooks/useSpacedRepetition";
import { useAdaptiveDifficulty } from "@/hooks/useAdaptiveDifficulty";
import { useDaily } from "@/hooks/useDaily";
import type { SupportedLanguage, Difficulty, SnippetLength, Snippet } from "@/lib/snippets";
import type { DifficultyTransition } from "@/lib/adaptive";

const CodePanel = dynamic(() => import("@/components/CodePanel"), {
    ssr: false,
    // Fill the reserved height (set by the wrapper below) so the panel does not
    // jump when the chunk hydrates and the real editor takes over.
    loading: () => <Box h="100%" minH="inherit" bg="var(--panel)" borderRadius="md" />,
});

const ResultScreen = dynamic(
    () => import("@/components/session/ResultScreen").then((m) => m.ResultScreen),
    { ssr: false, loading: () => null },
);

// Both are opened by user action only, and both used to be mounted with
// isOpen={false}, re-rendering on every keystroke of a run.
const LeaderboardModal = dynamic(() => import("@/components/LeaderboardModal"), { ssr: false });
const AIDrillPanel = dynamic(() => import("@/components/AIDrillPanel"), { ssr: false });

export default function TypingSession() {
    const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
    const [isDrillPanelOpen, setIsDrillPanelOpen] = useState(false);
    const [difficultyTransition, setDifficultyTransition] = useState<DifficultyTransition | undefined>(undefined);
    const panelContainerRef = useRef<HTMLDivElement | null>(null);
    const { isOverlayOpen, setOverlayOpen } = useOverlayState();

    const openLeaderboard = useCallback(() => setIsLeaderboardOpen(true), []);
    const closeLeaderboard = useCallback(() => setIsLeaderboardOpen(false), []);
    const openDrillPanel = useCallback(() => setIsDrillPanelOpen(true), []);
    const closeDrillPanel = useCallback(() => setIsDrillPanelOpen(false), []);

    // Publish this component's overlays into the shared gate so the engine's
    // capture-phase key handler stands down while one of them owns the keyboard.
    // The cleanups matter: without them an unmount (or a dynamic chunk that never
    // loads) would leave the gate latched and the keyboard dead.
    useEffect(() => {
        setOverlayOpen("leaderboard", isLeaderboardOpen);
        return () => setOverlayOpen("leaderboard", false);
    }, [isLeaderboardOpen, setOverlayOpen]);
    useEffect(() => {
        setOverlayOpen("ai-drill", isDrillPanelOpen);
        return () => setOverlayOpen("ai-drill", false);
    }, [isDrillPanelOpen, setOverlayOpen]);

    // Store engine reset function in a ref to break circular dependency
    const engineResetRef = useRef<() => void>(() => {});
    // Store SR recommendation function in a ref to break hook ordering dependency
    const srRecommendationRef = useRef<(availableIds: string[], currentId: string) => string | null>(() => null);
    // Tracks whether the in-flight run is the Daily Challenge so the finish
    // handler can record it. A ref so it survives start -> finish without re-render.
    const isDailyRunRef = useRef(false);
    // Set when a daily start is requested but the snippet has not propagated yet;
    // an effect fires engine.start() once the daily snippet is active.
    const pendingDailyStartRef = useRef(false);

    // Preferences
    const {
        preferences,
        setSurfaceStyle: persistSurfaceStyle,
        setShowLiveStatsDuringRun,
        setVimMode,
    } = usePreferences();

    const editorFontSize = preferences.fontSize;
    const storedSurfaceStyle = preferences.surfaceStyle ?? "panel";
    const interfaceMode = preferences.interfaceMode;
    const isTerminalMode = interfaceMode === "terminal";
    const effectiveSurfaceStyle = isTerminalMode ? "immersive" : storedSurfaceStyle;
    const isImmersive = effectiveSurfaceStyle === "immersive";
    const prefersReducedMotion = usePrefersReducedMotion() ?? false;

    // Focus Management
    const focus = useFocusManagement();

    // Session Controls (language, length, problem, snippet selection)
    const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>("python");
    const { snippets, refreshAIDrills } = useSnippets(selectedLanguage);

    // Use a stable callback that references the ref
    const handleResetEngine = useCallback(() => {
        engineResetRef.current();
    }, []);

    const handleGetNextRecommendation = useCallback(
        (availableIds: string[], currentId: string) => srRecommendationRef.current(availableIds, currentId),
        []
    );

    const controls = useSessionControls({
        snippets,
        onResetEngine: handleResetEngine,
        getNextRecommendation: handleGetNextRecommendation,
        language: selectedLanguage,
        setLanguage: setSelectedLanguage,
    });

    // Typing Engine
    const engine = useTypingEngine({
        snippet: controls.snippet,
    });

    // Update ref with actual reset function
    engineResetRef.current = engine.reset;

    // Every finish consumer below reads the engine's atomic final snapshot when a
    // run has ended, so persistence, achievements and the result screen can never
    // disagree about the sample (or round the elapsed time down to a timer tick).
    const finalSnapshot = engine.finalSnapshot;
    const resultMetrics = finalSnapshot ? finalSnapshot.metrics : engine.metrics;
    const resultElapsedMs = finalSnapshot ? finalSnapshot.elapsedMs : engine.elapsedMs;
    const resultErrorCount = finalSnapshot ? finalSnapshot.wrongChars.size : engine.wrongChars.size;
    const resultErrorLog = finalSnapshot ? finalSnapshot.errorLog : engine.errorLog;
    const resultHistory = finalSnapshot ? finalSnapshot.history : engine.history;
    const resultTotalKeystrokes = finalSnapshot ? finalSnapshot.totalKeystrokes : engine.totalKeystrokes;
    const resultCorrectKeystrokes = finalSnapshot ? finalSnapshot.correctKeystrokes : engine.correctKeystrokes;

    // Achievements, XP, Streaks
    const achievements = useAchievements({
        phase: engine.phase,
        session: {
            snippetId: controls.snippet.id,
            wpm: resultMetrics.adjustedWpm,
            accuracy: resultMetrics.accuracy,
            elapsedMs: resultElapsedMs,
            language: controls.language,
            difficulty: controls.snippet.difficulty,
            lengthCategory: controls.snippet.lengthCategory,
            errorCount: resultErrorCount,
            totalKeystrokes: resultTotalKeystrokes,
            correctKeystrokes: resultCorrectKeystrokes,
            patternScore: resultMetrics.patternScore,
            history: resultHistory,
        },
        preferences: {
            vimMode: preferences.vimMode,
            theme: preferences.theme,
        },
    });

    // Spaced Repetition
    const sr = useSpacedRepetition(controls.language, preferences.spacedRepetitionEnabled);
    // Update ref so controls can access the recommendation function
    srRecommendationRef.current = sr.getNextRecommendation;

    // Adaptive Difficulty
    const adaptive = useAdaptiveDifficulty(controls.language, preferences.adaptiveDifficultyEnabled);

    // Daily CodeSprint (date-seeded snippet, streak, share)
    const daily = useDaily();
    // Whether the just-finished run was the daily; surfaces the share block on the result.
    const [finishedDaily, setFinishedDaily] = useState(false);

    // Extract stable method refs to avoid callback identity churn
    const srUpdateMastery = sr.updateMastery;
    const adaptiveUpdateSkillModel = adaptive.updateSkillModel;
    const dailyRecord = daily.record;

    // Session finished callback for SR + adaptive updates
    const handleSessionFinished = useCallback((sessionData: {
        snippetId: string;
        language: SupportedLanguage;
        wpm: number;
        accuracy: number;
        patternScore?: number;
        difficulty: Difficulty;
        lengthCategory: SnippetLength;
    }) => {
        // Daily run: record it (idempotent per day) and flag the result screen.
        if (isDailyRunRef.current) {
            dailyRecord({
                wpm: sessionData.wpm,
                accuracy: sessionData.accuracy,
                patternScore: sessionData.patternScore,
            });
            setFinishedDaily(true);
        } else {
            setFinishedDaily(false);
        }
        srUpdateMastery({
            snippetId: sessionData.snippetId,
            language: sessionData.language,
            accuracy: sessionData.accuracy,
            patternScore: sessionData.patternScore,
        });
        if (!preferences.adaptiveDifficultyEnabled) {
            setDifficultyTransition(undefined);
            return;
        }
        void adaptiveUpdateSkillModel({
            wpm: sessionData.wpm,
            accuracy: sessionData.accuracy,
            difficulty: sessionData.difficulty,
        }).then(setDifficultyTransition);
    }, [srUpdateMastery, adaptiveUpdateSkillModel, preferences.adaptiveDifficultyEnabled, dailyRecord]);

    // Session Lifecycle (auto-advance, score saving)
    const lifecycle = useSessionLifecycle({
        phase: engine.phase,
        snippetId: controls.snippet.id,
        metrics: resultMetrics,
        language: controls.language,
        elapsedMs: resultElapsedMs,
        totalKeystrokes: resultTotalKeystrokes,
        correctKeystrokes: resultCorrectKeystrokes,
        errorCount: resultErrorCount,
        history: resultHistory,
        lengthCategory: controls.snippet.lengthCategory,
        difficulty: controls.snippet.difficulty,
        isAIDrill: controls.snippet.problemId.startsWith("ai-drill-"),
        errors: resultErrorLog,
        snippetContent: controls.snippet.content,
        onResetEngine: engine.reset,
        onSessionFinished: handleSessionFinished,
    });

    const lifecycleClearAutoAdvance = lifecycle.clearAutoAdvance;
    const controlsHandleNextProblem = controls.handleNextProblem;

    const goToNextProblem = useCallback(() => {
        isDailyRunRef.current = false;
        lifecycleClearAutoAdvance();
        controlsHandleNextProblem();
    }, [lifecycleClearAutoAdvance, controlsHandleNextProblem]);

    // Keyboard Shortcuts
    useKeyboardShortcuts({
        phase: engine.phase,
        vimMode: preferences.vimMode,
        problemCount: controls.problemOptions.length,
        engineHandleKeyDown: engine.handleKeyDown,
        onReset: engine.reset,
        onNextProblem: goToNextProblem,
        onStartEngine: engine.start,
        enableEditorFocus: focus.enableEditorFocus,
        focusEditor: focus.focusEditor,
        setVimMode,
        setShowLiveStatsDuringRun,
        showLiveStatsDuringRun: preferences.showLiveStatsDuringRun,
        clearAutoAdvance: lifecycleClearAutoAdvance,
        onOpenAIDrill: openDrillPanel,
        isOverlayOpen,
    });

    // Auto Scroll
    useAutoScroll({
        cursorIndex: engine.cursorIndex,
        phase: engine.phase,
        containerRef: panelContainerRef,
        enabled: true,
    });

    // Focus Active Class
    useFocusActiveClass(engine.phase);

    // Derived UI State
    const focusActive = engine.phase === "running";
    const showChrome = isTerminalMode ? true : !focusActive;
    const controlsDisabled = engine.phase === "running" || engine.phase === "countdown";
    const showRunningStats = engine.phase === "running" && preferences.showLiveStatsDuringRun;

    const reservedEditorHeight = useMemo(
        () => estimateEditorHeight(controls.snippet.content, editorFontSize),
        [controls.snippet.content, editorFontSize],
    );
    const total = controls.snippet.content.length;
    const progress = total === 0 ? 0 : Math.min(1, engine.cursorIndex / total);

    const layoutGap = getLayoutGap(isTerminalMode, isImmersive);
    const panelMotion = getPanelMotion(prefersReducedMotion);
    const sessionSwapMotion = getSessionSwapMotion(prefersReducedMotion);

    // Depend on the individual stable callbacks, not on the `focus` / `engine`
    // objects — those are new literals every render, which would break the memo
    // on every child that receives one of these handlers.
    const enableEditorFocus = focus.enableEditorFocus;
    const focusEditor = focus.focusEditor;
    const engineStart = engine.start;

    // Handlers
    const handleStart = useCallback(() => {
        isDailyRunRef.current = false;
        enableEditorFocus();
        engineStart();
        focusEditor();
    }, [enableEditorFocus, engineStart, focusEditor]);

    // Start (or re-practice) today's Daily Challenge. setSnippet updates state
    // asynchronously, so defer engine.start() until the daily snippet is active.
    const handleStartDaily = useCallback(() => {
        if (!daily.dailySnippet) return;
        isDailyRunRef.current = true;
        controls.setSnippet(daily.dailySnippet);
        if (controls.snippet.id === daily.dailySnippet.id) {
            enableEditorFocus();
            engineStart();
            focusEditor();
        } else {
            pendingDailyStartRef.current = true;
        }
    }, [daily.dailySnippet, controls, enableEditorFocus, engineStart, focusEditor]);

    // Fire the deferred daily start once the daily snippet has become active.
    useEffect(() => {
        if (!pendingDailyStartRef.current) return;
        if (!daily.dailySnippet) return;
        if (controls.snippet.id !== daily.dailySnippet.id) return;
        pendingDailyStartRef.current = false;
        enableEditorFocus();
        engineStart();
        focusEditor();
    }, [controls.snippet.id, daily.dailySnippet, enableEditorFocus, engineStart, focusEditor]);

    const handleNextProblem = useCallback(() => {
        enableEditorFocus();
        goToNextProblem();
    }, [enableEditorFocus, goToNextProblem]);

    useEffect(() => {
        if (engine.phase !== "finished") {
            setDifficultyTransition(undefined);
            setFinishedDaily(false);
        }
    }, [engine.phase]);

    // Warm the result chunk while the user types so the finish transition never
    // waits on a network round trip.
    useEffect(() => {
        if (engine.phase !== "running") return;
        void import("@/components/session/ResultScreen");
    }, [engine.phase]);

    const handleDrillAccept = useCallback(async (snippet: Snippet) => {
        await refreshAIDrills();
        controls.setSnippet(snippet);
    }, [controls, refreshAIDrills]);

    return (
        <Box position="relative" minH="400px">
            <AnimatePresence mode="wait">
                {engine.phase !== "finished" ? (
                    <m.div
                        key="session"
                        {...sessionSwapMotion}
                        style={{ width: "100%" }}
                    >
                        {/* Tighter between the stacked blocks on phones: every
                            pixel here is a pixel of editor above the fold. */}
                        <Box display="flex" flexDirection="column" gap={{ base: 5, md: 8 }}>
                            {/* Control Bar (hidden during focus) */}
                            {!focusActive && (
                                <SessionControlBar
                                    language={controls.language}
                                    onLanguageChange={controls.setLanguage}
                                    lengthPreference={controls.lengthPreference}
                                    onLengthChange={controls.setLengthPreference}
                                    surfaceStyle={storedSurfaceStyle}
                                    onSurfaceChange={persistSurfaceStyle}
                                    onStart={handleStart}
                                    phase={engine.phase}
                                    disabled={controlsDisabled}
                                    isTerminalMode={isTerminalMode}
                                    prefersReducedMotion={prefersReducedMotion}
                                    dueCount={sr.dueCount}
                                    suggestedDifficulty={adaptive.suggestedDifficulty}
                                    onOpenAIDrill={openDrillPanel}
                                />
                            )}

                            {/* Daily Challenge (idle only) */}
                            {engine.phase === "idle" && (
                                <DailyChallengeCard
                                    dateStr={daily.today}
                                    dayNumber={daily.dayNumber}
                                    streak={daily.streak}
                                    completed={daily.completed}
                                    language={daily.dailySnippet?.language ?? controls.language}
                                    available={daily.dailySnippet !== null}
                                    todaysResult={daily.completed ? daily.progress.best : undefined}
                                    onStart={handleStartDaily}
                                    disabled={controlsDisabled}
                                />
                            )}

                            {/* Main Panel Area */}
                            <Stack w="100%" gap={layoutGap} align="center">
                                <Box w="100%" position="relative">
                                    <m.div
                                        ref={panelContainerRef}
                                        key={`${controls.snippet.id}-${controls.language}-${controls.lengthPreference}`}
                                        {...panelMotion}
                                        layout
                                        style={{ display: "flex", justifyContent: "center", width: "100%" }}
                                    >
                                        <Box display="flex" flexDirection="column" gap={4} maxW="100%" mx="auto" w="100%">
                                            {/* Top Bar (progress, problem info, actions) */}
                                            <SessionTopBar
                                                progress={progress}
                                                isTerminalMode={isTerminalMode}
                                                isImmersive={isImmersive}
                                                showChrome={showChrome}
                                                prefersReducedMotion={prefersReducedMotion}
                                                currentProblem={controls.currentProblem}
                                                problemCount={controls.problemOptions.length}
                                                onNextProblem={handleNextProblem}
                                                onLeaderboardOpen={openLeaderboard}
                                            />

                                            {/* Live Stats (during running) */}
                                            {showRunningStats && (
                                                // Left-aligned with the code panel below it: centred, the
                                                // card floated over left-aligned code with nothing to
                                                // line up against.
                                                <Box alignSelf="flex-start" width="100%" maxW="md">
                                                    <LiveStats wpm={engine.metrics.adjustedWpm} accuracy={engine.metrics.accuracy} />
                                                </Box>
                                            )}

                                            {/* Code Panel — reserve the editor's real height so the
                                                dynamic-import loading placeholder does not cause a mount-time jump. */}
                                            <Box w="100%" minH={`${reservedEditorHeight}px`}>
                                                <CodePanel
                                                    content={controls.snippet.content}
                                                    cursorChar={engine.cursorIndex}
                                                    wrongChars={engine.wrongChars}
                                                    language={controls.language}
                                                    caretErrorActive={engine.caretErrorActive}
                                                    onReady={focus.handleEditorReady}
                                                    fontSize={editorFontSize}
                                                    surfaceStyle={effectiveSurfaceStyle}
                                                    syntaxHighlighting={preferences.syntaxHighlighting}
                                                />
                                            </Box>

                                            {/* Debug Gap Buffer */}
                                            {preferences.debugGapBuffer && (
                                                <GapBufferVisualizer
                                                    content={controls.snippet.content}
                                                    cursorIndex={engine.cursorIndex}
                                                />
                                            )}
                                        </Box>
                                    </m.div>

                                    {/* Countdown Overlay */}
                                    <CountdownOverlay
                                        isActive={engine.phase === "countdown"}
                                        countdownValue={engine.countdown}
                                        prefersReducedMotion={prefersReducedMotion}
                                    />
                                </Box>
                            </Stack>
                        </Box>
                    </m.div>
                ) : (
                    /* Result Screen */
                    <ResultScreen
                        wpm={resultMetrics.adjustedWpm}
                        rawWpm={resultMetrics.rawWpm}
                        accuracy={resultMetrics.accuracy}
                        timeMs={resultElapsedMs}
                        errors={resultErrorCount}
                        totalKeystrokes={resultTotalKeystrokes}
                        correctKeystrokes={resultCorrectKeystrokes}
                        theme={preferences.theme}
                        snippetTitle={controls.snippet.title}
                        snippetId={controls.snippet.id}
                        language={controls.language}
                        difficulty={controls.snippet.difficulty}
                        lengthCategory={controls.snippet.lengthCategory}
                        errorLog={resultErrorLog}
                        history={resultHistory}
                        autoAdvanceDeadline={lifecycle.autoAdvanceDeadline}
                        canAdvance={controls.problemOptions.length > 1}
                        onNext={handleNextProblem}
                        prefersReducedMotion={prefersReducedMotion}
                        patternScore={resultMetrics.patternScore}
                        tokens={controls.snippet.tokens}
                        contentLength={controls.snippet.content.length}
                        xpGained={achievements.xpGained}
                        newlyUnlocked={achievements.newlyUnlocked}
                        difficultyTransition={preferences.adaptiveDifficultyEnabled ? difficultyTransition : undefined}
                        isAIDrill={controls.snippet.problemId.startsWith("ai-drill-")}
                        priorBestWpm={lifecycle.priorBestWpm}
                        isNewBest={lifecycle.isNewBest}
                        daily={
                            finishedDaily
                                ? {
                                      dateStr: daily.today,
                                      dayNumber: daily.dayNumber,
                                      streak: daily.streak,
                                  }
                                : undefined
                        }
                    />
                )}
            </AnimatePresence>

            {isLeaderboardOpen && (
                <LeaderboardModal
                    isOpen
                    onOpenChange={(e) => { if (!e.open) closeLeaderboard(); }}
                />
            )}

            {isDrillPanelOpen && (
                <AIDrillPanel
                    isOpen
                    onClose={closeDrillPanel}
                    onAccept={handleDrillAccept}
                    language={controls.language}
                />
            )}
        </Box>
    );
}
