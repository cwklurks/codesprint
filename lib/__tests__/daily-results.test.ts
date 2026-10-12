import { beforeEach, describe, expect, it } from "vitest";
import { getDailyProgress, getDailyResult, recordDailyResult } from "../daily-store";

beforeEach(() => localStorage.clear());

describe("daily results by date", () => {
    it("retains today's actual result after reload without replacing the all-time best", () => {
        recordDailyResult("2026-10-12", { wpm: 110, accuracy: 0.99 });
        recordDailyResult("2026-10-13", { wpm: 90, accuracy: 0.95 });
        const progress = getDailyProgress();
        expect(progress.best).toEqual({ wpm: 110, accuracy: 0.99, dateStr: "2026-10-12" });
        expect(progress.resultsByDate?.["2026-10-13"]).toEqual({ wpm: 90, accuracy: 0.95, dateStr: "2026-10-13" });
    });
});

it("keeps the best run for each date when the user practices again", () => {
    recordDailyResult("2026-10-12", { wpm: 110, accuracy: 0.99 });
    recordDailyResult("2026-10-13", { wpm: 90, accuracy: 0.95 });
    recordDailyResult("2026-10-13", { wpm: 80, accuracy: 0.9 });
    recordDailyResult("2026-10-13", { wpm: 90, accuracy: 0.92 });
    let progress = getDailyProgress();
    expect(getDailyResult(progress, "2026-10-13")).toEqual({ wpm: 90, accuracy: 0.95, dateStr: "2026-10-13" });
    recordDailyResult("2026-10-13", { wpm: 100, accuracy: 0.97 });
    progress = getDailyProgress();
    expect(getDailyResult(progress, "2026-10-13")).toEqual({ wpm: 100, accuracy: 0.97, dateStr: "2026-10-13" });
    expect(progress.best?.wpm).toBe(110);
    expect(progress.streak.currentStreak).toBe(2);
    expect(progress.completedDates).toEqual(["2026-10-12", "2026-10-13"]);
});

it("migrates only the known date of a legacy all-time best", () => {
    const legacy = { ...recordDailyResult("2026-10-12", { wpm: 110, accuracy: 0.99 }), completedDates: ["2026-10-12", "2026-10-13"], lastCompletedDate: "2026-10-13" };
    delete legacy.resultsByDate;
    localStorage.setItem("codesprint-daily", JSON.stringify(legacy));
    const progress = getDailyProgress();
    expect(getDailyResult(progress, "2026-10-12")).toEqual(legacy.best);
    expect(getDailyResult(progress, "2026-10-13")).toBeUndefined();
    expect(getDailyResult(progress, "2026-10-14")).toBeUndefined();
    recordDailyResult("2026-10-13", { wpm: 90, accuracy: 0.95 });
    expect(getDailyResult(getDailyProgress(), "2026-10-13")?.wpm).toBe(90);
    expect(getDailyProgress().best).toEqual(legacy.best);
});

it("never substitutes a result from a different date or an invalid stored result", () => {
    const progress = recordDailyResult("2026-10-13", { wpm: 90, accuracy: 0.95 });
    localStorage.setItem("codesprint-daily", JSON.stringify({
        ...progress, best: undefined,
        completedDates: ["2026-10-13", "2026-10-14", "2026-02-30", "2026-10-16"],
        resultsByDate: {
            "2026-10-13": { wpm: 110, accuracy: 0.99, dateStr: "2026-10-12" },
            "2026-10-14": null,
            "2026-02-30": { wpm: 80, accuracy: 1, dateStr: "2026-02-30" },
            "2026-10-16": { wpm: "80", accuracy: 1, dateStr: "2026-10-16" },
            "2026-10-17": { wpm: 80, accuracy: 1, dateStr: "2026-10-17" },
        },
    }));
    expect(getDailyProgress().resultsByDate).toEqual({});
    expect(getDailyResult(getDailyProgress(), "2026-10-13")).toBeUndefined();
});

it.each([null, [], "broken"])("tolerates missing or malformed per-date storage: %s", (resultsByDate) => {
    localStorage.setItem("codesprint-daily", JSON.stringify({ completedDates: ["2026-10-13"], resultsByDate }));
    expect(getDailyResult(getDailyProgress(), "2026-10-13")).toBeUndefined();
    expect(recordDailyResult("2026-10-13", { wpm: 90, accuracy: 0.95 }).resultsByDate?.["2026-10-13"].wpm).toBe(90);
});
