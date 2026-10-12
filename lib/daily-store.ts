import { updateStreak, type StreakState } from "./streaks";

export type DailyBest = {
    wpm: number;
    accuracy: number;
    dateStr: string;
};

export type DailyProgress = {
    streak: StreakState;
    lastCompletedDate: string;
    completedDates: string[];
    best?: DailyBest;
    /** Best run for each completed date, independent of the all-time best. */
    resultsByDate?: Record<string, DailyBest>;
};

export type DailyResult = {
    wpm: number;
    accuracy: number;
    patternScore?: number;
};

const STORAGE_KEY = "codesprint-daily";

function emptyProgress(): DailyProgress {
    return {
        streak: {
            currentStreak: 0,
            longestStreak: 0,
            lastActiveDate: "",
            streakStartDate: "",
        },
        lastCompletedDate: "",
        completedDates: [],
    };
}

function isDailyBest(value: unknown): value is DailyBest {
    if (!value || typeof value !== "object") return false;
    const result = value as DailyBest;
    const date = typeof result.dateStr === "string" ? new Date(`${result.dateStr}T00:00:00Z`) : new Date(NaN);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === result.dateStr
        && typeof result.wpm === "number" && Number.isFinite(result.wpm) && result.wpm >= 0
        && typeof result.accuracy === "number" && Number.isFinite(result.accuracy) && result.accuracy >= 0;
}

/** Returns only a result attributed to this completed date, including legacy best data. */
export function getDailyResult(progress: DailyProgress, dateStr: string): DailyBest | undefined {
    if (!progress.completedDates.includes(dateStr)) return undefined;
    const result = progress.resultsByDate?.[dateStr];
    if (isDailyBest(result) && result.dateStr === dateStr) return result;
    return isDailyBest(progress.best) && progress.best.dateStr === dateStr ? progress.best : undefined;
}

export function getDailyProgress(): DailyProgress {
    if (typeof window === "undefined") return emptyProgress();

    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (!stored) return emptyProgress();
        const parsed = JSON.parse(stored) as Partial<DailyProgress>;
        const fallback = emptyProgress();
        const completedDates = Array.isArray(parsed.completedDates)
            ? parsed.completedDates.filter((date): date is string => typeof date === "string")
            : fallback.completedDates;
        const resultsByDate: Record<string, DailyBest> = {};
        if (parsed.resultsByDate && typeof parsed.resultsByDate === "object") {
            for (const [date, result] of Object.entries(parsed.resultsByDate)) {
                if (isDailyBest(result) && result.dateStr === date && completedDates.includes(date)) {
                    resultsByDate[date] = result;
                }
            }
        }
        // Old storage retained only the all-time best. Recover its known date,
        // but never fabricate results for other completed days.
        if (isDailyBest(parsed.best) && completedDates.includes(parsed.best.dateStr) && !resultsByDate[parsed.best.dateStr]) {
            resultsByDate[parsed.best.dateStr] = parsed.best;
        }
        return {
            streak: parsed.streak ?? fallback.streak,
            lastCompletedDate:
                parsed.lastCompletedDate ?? fallback.lastCompletedDate,
            completedDates,
            best: parsed.best,
            resultsByDate,
        };
    } catch (err) {
        console.warn("Failed to load daily progress", err);
        return emptyProgress();
    }
}

export function isDailyCompleted(dateStr: string): boolean {
    return getDailyProgress().completedDates.includes(dateStr);
}

export function recordDailyResult(
    dateStr: string,
    result: DailyResult
): DailyProgress {
    const prev = getDailyProgress();
    const alreadyCompleted = prev.completedDates.includes(dateStr);

    // Idempotent per day: same date never re-runs the streak or re-adds the date.
    const streak = alreadyCompleted || dateStr < prev.streak.lastActiveDate
        ? prev.streak
        : updateStreak(
              prev.streak.lastActiveDate ? prev.streak : undefined,
              dateStr
          ).newState;

    const completedDates = alreadyCompleted
        ? prev.completedDates
        : [...prev.completedDates, dateStr];

    const best =
        prev.best && prev.best.wpm >= result.wpm
            ? prev.best
            : { wpm: result.wpm, accuracy: result.accuracy, dateStr };

    const previousDaily = getDailyResult(prev, dateStr);
    const dailyBest = previousDaily && previousDaily.wpm >= result.wpm
        ? previousDaily
        : { wpm: result.wpm, accuracy: result.accuracy, dateStr };

    const next: DailyProgress = {
        streak,
        lastCompletedDate: prev.lastCompletedDate > dateStr ? prev.lastCompletedDate : dateStr,
        completedDates,
        best,
        resultsByDate: { ...prev.resultsByDate, [dateStr]: dailyBest },
    };

    if (typeof window !== "undefined") {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch (err) {
            console.warn("Failed to save daily progress", err);
        }
    }

    return next;
}
