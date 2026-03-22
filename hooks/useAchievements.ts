"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AchievementDefinition, AchievementContext } from "@/lib/achievements";
import { checkAchievements } from "@/lib/achievements";
import type { StreakState } from "@/lib/streaks";
import { updateStreak, getLocalDateString } from "@/lib/streaks";
import { computeSessionXp, computeLevelFromXp } from "@/lib/xp";
import type { LevelInfo } from "@/lib/xp";
import { getSessionsAsync, getSessionStatsAsync } from "@/lib/storage/session-history";
import type { SessionRecord } from "@/lib/storage/session-history";
import {
    idbGetAll,
    idbPut,
    getMetaValue,
    setMetaValue,
    STORES,
} from "@/lib/storage/idb-store";
import type { AchievementRecord } from "@/lib/storage/idb-store";
import type { Difficulty, SnippetLength } from "@/lib/snippets";

export interface UseAchievementsProps {
    phase: "idle" | "countdown" | "running" | "finished";
    session: {
        snippetId: string;
        wpm: number;
        accuracy: number;
        elapsedMs: number;
        language: string;
        difficulty: string;
        lengthCategory: string;
        errorCount: number;
        totalKeystrokes: number;
        correctKeystrokes: number;
        patternScore?: number;
        history: unknown[];
    };
    preferences: {
        vimMode: boolean;
        theme: string;
    };
}

export interface UseAchievementsReturn {
    newlyUnlocked: AchievementDefinition[];
    streakState: StreakState | null;
    xpGained: number;
    totalXp: number;
    level: number;
    levelProgress: number;
    dismissAchievements: () => void;
}

export function useAchievements({
    phase,
    session,
    preferences,
}: UseAchievementsProps): UseAchievementsReturn {
    const [newlyUnlocked, setNewlyUnlocked] = useState<AchievementDefinition[]>([]);
    const [streakState, setStreakState] = useState<StreakState | null>(null);
    const [xpGained, setXpGained] = useState(0);
    const [totalXp, setTotalXp] = useState(0);
    const [level, setLevel] = useState(1);
    const [levelProgress, setLevelProgress] = useState(0);

    const hasProcessedRef = useRef(false);
    const processingRef = useRef(false);

    // Reset guard when phase changes away from "finished"
    useEffect(() => {
        if (phase !== "finished") {
            hasProcessedRef.current = false;
        }
    }, [phase]);

    const sessionSnippetId = session.snippetId;
    const sessionWpm = session.wpm;
    const sessionAccuracy = session.accuracy;
    const sessionElapsedMs = session.elapsedMs;
    const sessionLanguage = session.language;
    const sessionDifficulty = session.difficulty;
    const sessionLengthCategory = session.lengthCategory;
    const sessionErrorCount = session.errorCount;
    const sessionTotalKeystrokes = session.totalKeystrokes;
    const sessionCorrectKeystrokes = session.correctKeystrokes;
    const sessionPatternScore = session.patternScore;
    const sessionHistory = session.history;
    const prefVimMode = preferences.vimMode;
    const prefTheme = preferences.theme;

    useEffect(() => {
        if (phase !== "finished" || hasProcessedRef.current || processingRef.current) return;
        hasProcessedRef.current = true;
        processingRef.current = true;

        async function process() {
            try {
                // 1. Load data from IDB
                const [
                    recentSessions,
                    stats,
                    storedStreak,
                    storedTotalXp,
                    unlockedRecords,
                    storedVimCount,
                    storedThemes,
                ] = await Promise.all([
                    getSessionsAsync(),
                    getSessionStatsAsync(),
                    getMetaValue<StreakState>("streak"),
                    getMetaValue<number>("totalXp"),
                    idbGetAll<AchievementRecord>(STORES.achievements),
                    getMetaValue<number>("vimModeSessionCount"),
                    getMetaValue<string[]>("themesUsed"),
                ]);

                // 2. Update streak
                const today = getLocalDateString();
                const streakUpdate = updateStreak(storedStreak, today);
                await setMetaValue("streak", streakUpdate.newState);

                // 3. Compute XP
                const xpResult = computeSessionXp({
                    wpm: sessionWpm,
                    accuracy: sessionAccuracy,
                    difficulty: sessionDifficulty as Difficulty,
                    lengthCategory: sessionLengthCategory as SnippetLength,
                });
                const prevXp = storedTotalXp ?? 0;
                const newTotalXp = prevXp + xpResult.sessionXp;
                await setMetaValue("totalXp", newTotalXp);

                // 4. Compute level
                const levelInfo: LevelInfo = computeLevelFromXp(newTotalXp);

                // 5. Track vim mode
                let vimCount = storedVimCount ?? 0;
                if (prefVimMode) {
                    vimCount += 1;
                    await setMetaValue("vimModeSessionCount", vimCount);
                }

                // 6. Track themes
                const themesArr = storedThemes ?? [];
                const themesSet = new Set(themesArr);
                themesSet.add(prefTheme);
                const updatedThemes = Array.from(themesSet);
                await setMetaValue("themesUsed", updatedThemes);

                // 7. Build context and check achievements
                const alreadyUnlocked = new Set(unlockedRecords.map((r) => r.id));

                const allLanguages = new Set(recentSessions.map((s: SessionRecord) => s.language));
                allLanguages.add(sessionLanguage as AchievementContext["session"]["language"]);

                const sessionsPerLanguage: Record<string, number> = {};
                for (const s of recentSessions) {
                    sessionsPerLanguage[s.language] = (sessionsPerLanguage[s.language] ?? 0) + 1;
                }
                sessionsPerLanguage[sessionLanguage] = (sessionsPerLanguage[sessionLanguage] ?? 0) + 1;

                // Count consecutive high accuracy sessions (>95%)
                let consecutiveHighAcc = sessionAccuracy > 0.95 ? 1 : 0;
                if (consecutiveHighAcc > 0) {
                    for (const s of recentSessions) {
                        if (s.accuracy > 0.95) {
                            consecutiveHighAcc += 1;
                        } else {
                            break;
                        }
                    }
                }

                // Build snippet best WPM map
                const snippetBestWpm: Record<string, number> = {};
                for (const s of recentSessions) {
                    const current = snippetBestWpm[s.snippetId];
                    if (current === undefined || s.wpm > current) {
                        snippetBestWpm[s.snippetId] = s.wpm;
                    }
                }

                const ctx: AchievementContext = {
                    session: {
                        snippetId: sessionSnippetId,
                        wpm: sessionWpm,
                        accuracy: sessionAccuracy,
                        elapsedMs: sessionElapsedMs,
                        language: sessionLanguage as AchievementContext["session"]["language"],
                        difficulty: sessionDifficulty as Difficulty,
                        lengthCategory: sessionLengthCategory as SnippetLength,
                        errorCount: sessionErrorCount,
                        totalKeystrokes: sessionTotalKeystrokes,
                        correctKeystrokes: sessionCorrectKeystrokes,
                        patternScore: sessionPatternScore,
                        history: sessionHistory as AchievementContext["session"]["history"],
                    },
                    stats: {
                        totalSessions: stats.totalSessions + 1,
                        averageWpm: stats.averageWpm,
                        bestWpm: Math.max(stats.bestWpm, sessionWpm),
                        totalTimeMs: stats.totalTimeMs + sessionElapsedMs,
                    },
                    recentSessions,
                    allSessionLanguages: allLanguages,
                    sessionsPerLanguage,
                    streak: streakUpdate.newState,
                    level: levelInfo.level,
                    vimModeSessionCount: vimCount,
                    themesUsed: updatedThemes.length,
                    sessionHour: new Date().getHours(),
                    consecutiveHighAccuracySessions: consecutiveHighAcc,
                    snippetBestWpm,
                };

                const unlocked = checkAchievements(ctx, alreadyUnlocked);

                // 8. Save newly unlocked achievements
                const now = new Date().toISOString();
                await Promise.all(
                    unlocked.map((a) =>
                        idbPut<AchievementRecord>(STORES.achievements, {
                            id: a.id,
                            unlockedAt: now,
                        })
                    )
                );

                // 9. Update state
                setNewlyUnlocked(unlocked);
                setStreakState(streakUpdate.newState);
                setXpGained(xpResult.sessionXp);
                setTotalXp(newTotalXp);
                setLevel(levelInfo.level);
                setLevelProgress(levelInfo.progress);
            } catch (error) {
                console.error("[useAchievements] Failed to process session:", error);
                hasProcessedRef.current = false;
            } finally {
                processingRef.current = false;
            }
        }

        process();
    }, [
        phase,
        sessionSnippetId, sessionWpm, sessionAccuracy, sessionElapsedMs,
        sessionLanguage, sessionDifficulty, sessionLengthCategory,
        sessionErrorCount, sessionTotalKeystrokes, sessionCorrectKeystrokes,
        sessionPatternScore, sessionHistory, prefVimMode, prefTheme,
    ]);

    const dismissAchievements = useCallback(() => {
        setNewlyUnlocked([]);
    }, []);

    return {
        newlyUnlocked,
        streakState,
        xpGained,
        totalXp,
        level,
        levelProgress,
        dismissAchievements,
    };
}
