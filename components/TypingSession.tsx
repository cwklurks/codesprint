"use client";

import { useCallback, useRef, useState } from "react";
import { Box, Stack } from "@chakra-ui/react";
import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";

import GapBufferVisualizer from "@/components/GapBufferVisualizer";
import LiveStats from "@/components/LiveStats";
import LeaderboardModal from "@/components/LeaderboardModal";

import { SessionControlBar } from "@/components/session/SessionControlBar";
import { SessionTopBar } from "@/components/session/SessionTopBar";
import { CountdownOverlay } from "@/components/session/CountdownOverlay";
import { ResultScreen } from "@/components/session/ResultScreen";

import { usePrefersReducedMotion } from "@/lib/motion";
import { usePreferences } from "@/lib/preferences";
import { getPanelMotion } from "@/lib/motion-config";
import { getLayoutGap } from "@/lib/session-styles";

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
import type { SupportedLanguage, Difficulty, SnippetLength } from "@/lib/snippets";

const CodePanel = dynamic(() => import("@/components/CodePanel"), {
    ssr: false,
    loading: () => <Box h="400px" bg="var(--panel)" borderRadius="md" />,
});

export default function TypingSession() {
    const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
    const panelContainerRef = useRef<HTMLDivElement | null>(null);

    // Store engine reset function in a ref to break circular dependency
    const engineResetRef = useRef<() => void>(() => {});
    // Store SR recommendation function in a ref to break hook ordering dependency
    const srRecommendationRef = useRef<(availableIds: string[], currentId: string) => string | null>(() => null);

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
    const { snippets } = useSnippets(selectedLanguage);

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

    // Achievements, XP, Streaks
    const achievements = useAchievements({
        phase: engine.phase,
        session: {
            snippetId: controls.snippet.id,
            wpm: engine.metrics.adjustedWpm,
            accuracy: engine.metrics.accuracy,
            elapsedMs: engine.elapsedMs,
            language: controls.language,
            difficulty: controls.snippet.difficulty,
            lengthCategory: controls.snippet.lengthCategory,
            errorCount: engine.wrongChars.size,
            totalKeystrokes: engine.totalKeystrokes,
            correctKeystrokes: engine.correctKeystrokes,
            patternScore: engine.metrics.patternScore,
            history: engine.history,
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

    // Extract stable method refs to avoid callback identity churn
    const srUpdateMastery = sr.updateMastery;
    const adaptiveUpdateSkillModel = adaptive.updateSkillModel;

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
        srUpdateMastery({
            snippetId: sessionData.snippetId,
            language: sessionData.language,
            accuracy: sessionData.accuracy,
            patternScore: sessionData.patternScore,
        });
        adaptiveUpdateSkillModel({
            wpm: sessionData.wpm,
            accuracy: sessionData.accuracy,
            difficulty: sessionData.difficulty,
        });
    }, [srUpdateMastery, adaptiveUpdateSkillModel]);

    // Session Lifecycle (auto-advance, score saving)
    const lifecycle = useSessionLifecycle({
        phase: engine.phase,
        snippetId: controls.snippet.id,
        metrics: engine.metrics,
        language: controls.language,
        elapsedMs: engine.elapsedMs,
        totalKeystrokes: engine.totalKeystrokes,
        correctKeystrokes: engine.correctKeystrokes,
        errorCount: engine.wrongChars.size,
        history: engine.history,
        lengthCategory: controls.snippet.lengthCategory,
        difficulty: controls.snippet.difficulty,
        onResetEngine: engine.reset,
        onSessionFinished: handleSessionFinished,
    });

    // Keyboard Shortcuts
    useKeyboardShortcuts({
        phase: engine.phase,
        vimMode: preferences.vimMode,
        problemCount: controls.problemOptions.length,
        engineHandleKeyDown: engine.handleKeyDown,
        onReset: engine.reset,
        onNextProblem: () => {
            lifecycle.clearAutoAdvance();
            controls.handleNextProblem();
        },
        onStartEngine: engine.start,
        enableEditorFocus: focus.enableEditorFocus,
        focusEditor: focus.focusEditor,
        setVimMode,
        setShowLiveStatsDuringRun,
        showLiveStatsDuringRun: preferences.showLiveStatsDuringRun,
        clearAutoAdvance: lifecycle.clearAutoAdvance,
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

    const total = controls.snippet.content.length;
    const progress = total === 0 ? 0 : Math.min(1, engine.cursorIndex / total);

    const layoutGap = getLayoutGap(isTerminalMode, isImmersive);
    const panelMotion = getPanelMotion(prefersReducedMotion);

    // Handlers
    const handleStart = useCallback(() => {
        focus.enableEditorFocus();
        engine.start();
        focus.focusEditor();
    }, [focus, engine]);

    const handleNextProblem = useCallback(() => {
        focus.enableEditorFocus();
        lifecycle.clearAutoAdvance();
        controls.handleNextProblem();
    }, [focus, lifecycle, controls]);

    return (
        <Box position="relative" minH="400px">
            <AnimatePresence mode="wait">
                {engine.phase !== "finished" ? (
                    <motion.div
                        key="session"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        style={{ width: "100%" }}
                    >
                        <Box display="flex" flexDirection="column" gap={8}>
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
                                />
                            )}

                            {/* Main Panel Area */}
                            <Stack w="100%" gap={layoutGap} align="center">
                                <Box w="100%" position="relative">
                                    <motion.div
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
                                                onLeaderboardOpen={() => setIsLeaderboardOpen(true)}
                                            />

                                            {/* Live Stats (during running) */}
                                            {showRunningStats && (
                                                <Box alignSelf="center" width="100%" maxW="md">
                                                    <LiveStats wpm={engine.metrics.adjustedWpm} accuracy={engine.metrics.accuracy} />
                                                </Box>
                                            )}

                                            {/* Code Panel */}
                                            <CodePanel
                                                content={controls.snippet.content}
                                                cursorChar={engine.cursorIndex}
                                                wrongChars={engine.wrongChars}
                                                language={controls.language === "javascript" ? "javascript" : controls.language}
                                                caretErrorActive={engine.caretErrorActive}
                                                onReady={focus.handleEditorReady}
                                                fontSize={editorFontSize}
                                                surfaceStyle={effectiveSurfaceStyle}
                                                syntaxHighlighting={preferences.syntaxHighlighting}
                                            />

                                            {/* Debug Gap Buffer */}
                                            {preferences.debugGapBuffer && (
                                                <GapBufferVisualizer
                                                    content={controls.snippet.content}
                                                    cursorIndex={engine.cursorIndex}
                                                />
                                            )}
                                        </Box>
                                    </motion.div>

                                    {/* Countdown Overlay */}
                                    <CountdownOverlay
                                        isActive={engine.phase === "countdown"}
                                        countdownValue={engine.countdown}
                                        prefersReducedMotion={prefersReducedMotion}
                                    />
                                </Box>
                            </Stack>
                        </Box>
                    </motion.div>
                ) : (
                    /* Result Screen */
                    <ResultScreen
                        wpm={engine.metrics.adjustedWpm}
                        accuracy={engine.metrics.accuracy}
                        timeMs={engine.elapsedMs}
                        errors={engine.wrongChars.size}
                        snippetTitle={controls.snippet.title}
                        snippetId={controls.snippet.id}
                        language={controls.language}
                        difficulty={controls.snippet.difficulty}
                        lengthCategory={controls.snippet.lengthCategory}
                        errorLog={engine.errorLog}
                        history={engine.history}
                        autoAdvanceDeadline={lifecycle.autoAdvanceDeadline}
                        canAdvance={controls.problemOptions.length > 1}
                        onNext={handleNextProblem}
                        prefersReducedMotion={prefersReducedMotion}
                        patternScore={engine.metrics.patternScore}
                        tokens={controls.snippet.tokens}
                        contentLength={controls.snippet.content.length}
                        xpGained={achievements.xpGained}
                        newlyUnlocked={achievements.newlyUnlocked}
                        difficultyTransition={adaptive.suggestedDifficulty !== controls.snippet.difficulty ? { newDifficulty: adaptive.suggestedDifficulty, reason: "promoted" as const } : undefined}
                    />
                )}
            </AnimatePresence>

            <LeaderboardModal
                isOpen={isLeaderboardOpen}
                onOpenChange={(e) => setIsLeaderboardOpen(e.open)}
            />
        </Box>
    );
}
