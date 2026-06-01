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

export function getDailyProgress(): DailyProgress {
    if (typeof window === "undefined") return emptyProgress();

    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (!stored) return emptyProgress();
        const parsed = JSON.parse(stored) as Partial<DailyProgress>;
        const fallback = emptyProgress();
        return {
            streak: parsed.streak ?? fallback.streak,
            lastCompletedDate:
                parsed.lastCompletedDate ?? fallback.lastCompletedDate,
            completedDates: Array.isArray(parsed.completedDates)
                ? parsed.completedDates
                : fallback.completedDates,
            best: parsed.best,
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
    const streak = alreadyCompleted
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

    const next: DailyProgress = {
        streak,
        lastCompletedDate: dateStr,
        completedDates,
        best,
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
