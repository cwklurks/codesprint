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
    /** Today's local date as "YYYY-MM-DD", or empty until mounted. */
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
    record: (result: DailyResult, challengeDate?: string) => void;
}

/**
 * Daily CodeSprint state: today's seeded snippet plus persisted streak/progress.
 * localStorage is read after mount to avoid SSR/hydration mismatch.
 */
export function useDaily(): UseDailyReturn {
    // A date-independent initial render also matches statically generated HTML.
    const [today, setToday] = useState("");
    const dayNumber = useMemo(() => today ? getDailyNumber(today) : 0, [today]);

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        const refresh = () => {
            const now = new Date();
            setToday(getLocalDateString(now));
            setProgress(getDailyProgress());
            clearTimeout(timer);
            const midnight = new Date(now);
            midnight.setHours(24, 0, 0, 0);
            timer = setTimeout(refresh, midnight.getTime() - now.getTime());
        };
        const onVisible = () => {
            if (document.visibilityState === "visible") refresh();
        };
        refresh();
        window.addEventListener("focus", refresh);
        window.addEventListener("pageshow", refresh);
        document.addEventListener("visibilitychange", onVisible);
        return () => {
            clearTimeout(timer);
            window.removeEventListener("focus", refresh);
            window.removeEventListener("pageshow", refresh);
            document.removeEventListener("visibilitychange", onVisible);
        };
    }, []);

    // The pool is loaded on demand now, so the snippet arrives asynchronously.
    // Null until it resolves; the daily card renders its unavailable state.
    const [loadedDaily, setLoadedDaily] = useState<{ date: string; snippet: Snippet | null } | null>(null);
    const dailySnippet = loadedDaily?.date === today ? loadedDaily.snippet : null;

    useEffect(() => {
        if (!today) return;
        let cancelled = false;

        const load = () => {
            getTodaysDaily(today)
                .then((snippet) => {
                    if (!cancelled) setLoadedDaily({ date: today, snippet });
                })
                .catch((error) => {
                    console.warn("Failed to load today's daily snippet:", error);
                });
        };

        // The pool pulls in all four corpora (~693 KB of JSON). Nothing on the
        // first screen needs it, and on the critical path it competes with Monaco
        // for bandwidth and main-thread time — so wait for idle. The card renders
        // its loading state meanwhile.
        const canIdle = "requestIdleCallback" in window;
        const handle = canIdle
            ? window.requestIdleCallback(load, { timeout: 3000 })
            : window.setTimeout(load, 200);

        return () => {
            cancelled = true;
            if (canIdle) window.cancelIdleCallback(handle);
            else window.clearTimeout(handle);
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

    const record = useCallback(
        (result: DailyResult, challengeDate = getLocalDateString()) => {
            setToday(getLocalDateString());
            setProgress(recordDailyResult(challengeDate, result));
        },
        []
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
