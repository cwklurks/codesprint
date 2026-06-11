import { useCallback, useEffect, useMemo, useState } from "react";

import { getLocalDateString } from "@/lib/streaks";
import { getDailyNumber } from "@/lib/daily";
import { getTodaysDaily } from "@/lib/daily-pool";
import {
    getDailyProgress,
    recordDailyResult,
    type DailyProgress,
    type DailyResult,
} from "@/lib/daily-store";
import type { Snippet } from "@/lib/snippets";

export interface UseDailyReturn {
    /** Today's local date as "YYYY-MM-DD". */
    today: string;
    /** Sequential daily number (epoch-based). */
    dayNumber: number;
    /** Today's date-seeded snippet from the stable pool. */
    dailySnippet: Snippet | null;
    /** Latest persisted daily progress (streak, completions, best). */
    progress: DailyProgress;
    /** Whether today's daily has already been completed. */
    completed: boolean;
    /** Current daily streak length. */
    streak: number;
    /** Record a finished daily run (idempotent per day) and refresh state. */
    record: (result: DailyResult) => void;
}

/**
 * Daily CodeSprint state: today's seeded snippet plus persisted streak/progress.
 * localStorage is read after mount to avoid SSR/hydration mismatch.
 */
export function useDaily(): UseDailyReturn {
    const today = useMemo(() => getLocalDateString(), []);
    const dayNumber = useMemo(() => getDailyNumber(today), [today]);
    const [dailySnippet, setDailySnippet] = useState<Snippet | null>(null);

    // The daily pool lazy-loads the committed corpora; resolve it after mount.
    // The cancellation guard keeps a stale/unmounted resolution from setting state.
    useEffect(() => {
        let cancelled = false;
        getTodaysDaily(today)
            .then((snippet) => {
                if (!cancelled) setDailySnippet(snippet);
            })
            .catch((error) => {
                // Pool load failed (e.g. a stale chunk after a redeploy). Leave
                // dailySnippet null and surface it; getDailyPool retries next call.
                if (!cancelled) console.error("Failed to load today's daily:", error);
            });
        return () => {
            cancelled = true;
        };
    }, [today]);

    const [progress, setProgress] = useState<DailyProgress>(() => ({
        streak: {
            currentStreak: 0,
            longestStreak: 0,
            lastActiveDate: "",
            streakStartDate: "",
        },
        lastCompletedDate: "",
        completedDates: [],
    }));

    useEffect(() => {
        setProgress(getDailyProgress());
    }, [today]);

    const record = useCallback(
        (result: DailyResult) => {
            setProgress(recordDailyResult(today, result));
        },
        [today]
    );

    const completed = progress.completedDates.includes(today);
    const streak = progress.streak.currentStreak;

    return {
        today,
        dayNumber,
        dailySnippet,
        progress,
        completed,
        streak,
        record,
    };
}
