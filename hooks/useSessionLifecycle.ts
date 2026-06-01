"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveScore } from "@/lib/leaderboard";
import { createSessionAsync, getSessionStatsAsync } from "@/lib/storage/session-history";
import { isNewBest as computeIsNewBest } from "@/lib/personal-best";
import type { SupportedLanguage, SnippetLength, Difficulty } from "@/lib/snippets";
import type { HistoryEntry, ErrorEntry } from "@/hooks/useTypingEngine";
import type { Phase } from "./useFocusManagement";

export interface UseSessionLifecycleProps {
    phase: Phase;
    snippetId: string;
    metrics: {
        adjustedWpm: number;
        rawWpm: number;
        accuracy: number;
        patternScore?: number;
    };
    language: SupportedLanguage;
    elapsedMs: number;
    totalKeystrokes: number;
    correctKeystrokes: number;
    errorCount: number;
    history: HistoryEntry[];
    lengthCategory: SnippetLength;
    difficulty: Difficulty;
    isAIDrill?: boolean;
    // NEW - for AI drill weak pattern aggregation
    errors?: ErrorEntry[];
    snippetContent?: string;
    onResetEngine: () => void;
    onSessionFinished?: (sessionData: {
        snippetId: string;
        language: SupportedLanguage;
        wpm: number;
        accuracy: number;
        patternScore?: number;
        difficulty: Difficulty;
        lengthCategory: SnippetLength;
    }) => void;
}

export interface UseSessionLifecycleReturn {
    /** Deadline timestamp for auto-advance (null if not set) */
    autoAdvanceDeadline: number | null;
    /** Clear any pending auto-advance */
    clearAutoAdvance: () => void;
    /** Set auto-advance with a duration in ms */
    setAutoAdvance: (durationMs: number) => void;
    /** Best WPM across all prior runs, captured BEFORE the current run was persisted (undefined until the current run finishes) */
    priorBestWpm: number | undefined;
    /** Whether the just-finished run set a new personal best */
    isNewBest: boolean;
}

/**
 * Hook to manage session lifecycle including:
 * - Auto-advance timeout management
 * - Score saving on finish
 * - Engine reset on snippet change
 */
export function useSessionLifecycle({
    phase,
    snippetId,
    metrics,
    language,
    elapsedMs,
    totalKeystrokes,
    correctKeystrokes,
    errorCount,
    history,
    lengthCategory,
    difficulty,
    isAIDrill,
    errors,
    snippetContent,
    onResetEngine,
    onSessionFinished,
}: UseSessionLifecycleProps): UseSessionLifecycleReturn {
    const [autoAdvanceDeadline, setAutoAdvanceDeadline] = useState<number | null>(null);
    const [priorBestWpm, setPriorBestWpm] = useState<number | undefined>(undefined);
    const [isNewBest, setIsNewBest] = useState(false);
    const autoAdvanceTimeoutRef = useRef<number | null>(null);
    const hasSavedRef = useRef(false);

    const clearAutoAdvance = useCallback(() => {
        if (autoAdvanceTimeoutRef.current !== null) {
            window.clearTimeout(autoAdvanceTimeoutRef.current);
            autoAdvanceTimeoutRef.current = null;
        }
        setAutoAdvanceDeadline(null);
    }, []);

    const setAutoAdvance = useCallback((durationMs: number) => {
        clearAutoAdvance();
        setAutoAdvanceDeadline(Date.now() + durationMs);
        // Note: The actual timeout callback should be set up by the parent
        // This hook just manages the deadline state
    }, [clearAutoAdvance]);

    // Reset engine when snippet changes
    useEffect(() => {
        hasSavedRef.current = false;
        onResetEngine();
        clearAutoAdvance();
    }, [snippetId, onResetEngine, clearAutoAdvance]);

    // Reset the save guard whenever phase leaves "finished" so that:
    // - Replaying the same snippet (R key) triggers a fresh save on re-completion
    // - Backspacing out of finished and re-finishing saves with corrected metrics
    useEffect(() => {
        if (phase !== "finished") {
            hasSavedRef.current = false;
            setIsNewBest(false);
            setPriorBestWpm(undefined);
        }
    }, [phase]);

    // Save score on finish
    useEffect(() => {
        if (phase !== "finished" || hasSavedRef.current) return;
        hasSavedRef.current = true;

        saveScore({
            wpm: metrics.adjustedWpm,
            accuracy: metrics.accuracy,
            language,
            snippetId,
        });

        // Capture the prior best BEFORE persisting the current run so the
        // comparison never includes this run. Await the stats read, then
        // persist — this guarantees the read completes before the write,
        // regardless of underlying IndexedDB transaction timing.
        const currentWpm = metrics.adjustedWpm;
        getSessionStatsAsync()
            .then((stats) => {
                const prior = stats.totalSessions > 0 ? stats.bestWpm : undefined;
                setPriorBestWpm(prior);
                setIsNewBest(computeIsNewBest(currentWpm, prior));
            })
            .catch(() => {
                // Stats unavailable; leave PB state at its reset defaults.
            })
            .finally(() => {
                createSessionAsync({
                    snippetId,
                    language,
                    lengthCategory,
                    difficulty,
                    ...(isAIDrill !== undefined ? { isAIDrill } : {}),
                    wpm: metrics.adjustedWpm,
                    rawWpm: metrics.rawWpm,
                    accuracy: metrics.accuracy,
                    elapsedMs,
                    totalKeystrokes,
                    correctKeystrokes,
                    errorCount,
                    history,
                    patternScore: metrics.patternScore,
                    errors,
                    snippetContentLength: snippetContent?.length,
                    snippetContent,
                }).catch(() => {
                    // IndexedDB may be unavailable; legacy saveScore above provides fallback
                });
            });

        if (onSessionFinished) {
            onSessionFinished({
                snippetId,
                language,
                wpm: metrics.adjustedWpm,
                accuracy: metrics.accuracy,
                patternScore: metrics.patternScore,
                difficulty,
                lengthCategory,
            });
        }
    }, [phase, metrics.adjustedWpm, metrics.rawWpm, metrics.accuracy, metrics.patternScore, language, snippetId, elapsedMs, totalKeystrokes, correctKeystrokes, errorCount, history, lengthCategory, difficulty, isAIDrill, onSessionFinished, errors, snippetContent]);

    return {
        autoAdvanceDeadline,
        clearAutoAdvance,
        setAutoAdvance,
        priorBestWpm,
        isNewBest,
    };
}
