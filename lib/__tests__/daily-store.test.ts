import { describe, it, expect, beforeEach } from "vitest";
import {
    getDailyProgress,
    isDailyCompleted,
    recordDailyResult,
} from "../daily-store";

describe("daily-store", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    describe("getDailyProgress", () => {
        it("returns a sensible empty default when nothing is stored", () => {
            const progress = getDailyProgress();
            expect(progress.streak.currentStreak).toBe(0);
            expect(progress.streak.longestStreak).toBe(0);
            expect(progress.lastCompletedDate).toBe("");
            expect(progress.completedDates).toEqual([]);
            expect(progress.best).toBeUndefined();
        });
    });

    describe("isDailyCompleted", () => {
        it("is false before any completion", () => {
            expect(isDailyCompleted("2025-06-01")).toBe(false);
        });

        it("is true after the date is recorded", () => {
            recordDailyResult("2025-06-01", { wpm: 80, accuracy: 95 });
            expect(isDailyCompleted("2025-06-01")).toBe(true);
        });

        it("is false for a date that was not recorded", () => {
            recordDailyResult("2025-06-01", { wpm: 80, accuracy: 95 });
            expect(isDailyCompleted("2025-06-02")).toBe(false);
        });
    });

    describe("recordDailyResult", () => {
        it("sets streak to 1 and records the date on first completion", () => {
            const progress = recordDailyResult("2025-06-01", {
                wpm: 80,
                accuracy: 95,
            });
            expect(progress.streak.currentStreak).toBe(1);
            expect(progress.lastCompletedDate).toBe("2025-06-01");
            expect(progress.completedDates).toEqual(["2025-06-01"]);
        });

        it("increments streak to 2 on the next consecutive day", () => {
            recordDailyResult("2025-06-01", { wpm: 80, accuracy: 95 });
            const progress = recordDailyResult("2025-06-02", {
                wpm: 82,
                accuracy: 96,
            });
            expect(progress.streak.currentStreak).toBe(2);
            expect(progress.lastCompletedDate).toBe("2025-06-02");
            expect(progress.completedDates).toEqual([
                "2025-06-01",
                "2025-06-02",
            ]);
        });

        it("is idempotent for the same day: streak unchanged, date not duplicated", () => {
            recordDailyResult("2025-06-01", { wpm: 80, accuracy: 95 });
            const progress = recordDailyResult("2025-06-01", {
                wpm: 90,
                accuracy: 99,
            });
            expect(progress.streak.currentStreak).toBe(1);
            expect(progress.completedDates).toEqual(["2025-06-01"]);
        });

        it("resets streak to 1 after a multi-day gap", () => {
            recordDailyResult("2025-06-01", { wpm: 80, accuracy: 95 });
            const progress = recordDailyResult("2025-06-05", {
                wpm: 70,
                accuracy: 90,
            });
            expect(progress.streak.currentStreak).toBe(1);
            expect(progress.completedDates).toEqual([
                "2025-06-01",
                "2025-06-05",
            ]);
        });

        it("tracks best as the max wpm across days", () => {
            recordDailyResult("2025-06-01", { wpm: 80, accuracy: 95 });
            recordDailyResult("2025-06-02", { wpm: 110, accuracy: 98 });
            const progress = recordDailyResult("2025-06-03", {
                wpm: 90,
                accuracy: 92,
            });
            expect(progress.best).toEqual({
                wpm: 110,
                accuracy: 98,
                dateStr: "2025-06-02",
            });
        });

        it("does not lower best when a same-day repeat has a lower wpm", () => {
            recordDailyResult("2025-06-01", { wpm: 100, accuracy: 99 });
            const progress = recordDailyResult("2025-06-01", {
                wpm: 50,
                accuracy: 80,
            });
            expect(progress.best?.wpm).toBe(100);
        });

        it("persists across reads via getDailyProgress", () => {
            recordDailyResult("2025-06-01", { wpm: 80, accuracy: 95 });
            recordDailyResult("2025-06-02", { wpm: 82, accuracy: 96 });
            const reloaded = getDailyProgress();
            expect(reloaded.streak.currentStreak).toBe(2);
            expect(reloaded.completedDates).toEqual([
                "2025-06-01",
                "2025-06-02",
            ]);
        });
    });
});
