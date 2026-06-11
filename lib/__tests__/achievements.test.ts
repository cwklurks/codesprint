import { describe, it, expect } from "vitest";
import {
  ACHIEVEMENTS,
  checkAchievements,
  type AchievementContext,
  type AchievementCategory,
} from "../achievements";

function makeContext(
  overrides: Partial<AchievementContext> = {},
): AchievementContext {
  return {
    session: {
      snippetId: "javascript:two-sum",
      wpm: 40,
      accuracy: 0.9,
      elapsedMs: 60000,
      language: "javascript",
      difficulty: "easy",
      lengthCategory: "short",
      errorCount: 5,
      totalKeystrokes: 100,
      correctKeystrokes: 90,
      history: [],
      ...overrides.session,
    },
    stats: {
      totalSessions: 0,
      averageWpm: 40,
      bestWpm: 50,
      totalTimeMs: 60000,
      ...overrides.stats,
    },
    recentSessions: overrides.recentSessions ?? [],
    allSessionLanguages: overrides.allSessionLanguages ?? new Set(["javascript"]),
    sessionsPerLanguage: overrides.sessionsPerLanguage ?? { javascript: 1 },
    streak: overrides.streak ?? {
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: "2026-03-04",
      streakStartDate: "2026-03-04",
    },
    level: overrides.level ?? 1,
    vimModeSessionCount: overrides.vimModeSessionCount ?? 0,
    themesUsed: overrides.themesUsed ?? 1,
    sessionHour: overrides.sessionHour ?? 14,
    consecutiveHighAccuracySessions:
      overrides.consecutiveHighAccuracySessions ?? 0,
    snippetBestWpm: overrides.snippetBestWpm ?? {},
  };
}

describe("achievements", () => {
  it("has exactly 40 achievement definitions", () => {
    expect(ACHIEVEMENTS).toHaveLength(40);
  });

  it("has unique ids for every achievement", () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  describe("category distribution", () => {
    const counts: Record<string, number> = {};
    for (const a of ACHIEVEMENTS) {
      counts[a.category] = (counts[a.category] ?? 0) + 1;
    }

    it.each([
      ["speed", 6],
      ["accuracy", 5],
      ["consistency", 6],
      ["exploration", 6],
      ["milestone", 5],
      ["improvement", 5],
      ["challenge", 5],
      ["special", 2],
    ] as [AchievementCategory, number][])(
      "has %i %s achievements",
      (category, expected) => {
        expect(counts[category]).toBe(expected);
      },
    );
  });

  describe("checkAchievements", () => {
    it("filters out already unlocked achievements", () => {
      const ctx = makeContext({ stats: { totalSessions: 1, averageWpm: 40, bestWpm: 50, totalTimeMs: 60000 } });
      const allNew = checkAchievements(ctx, new Set());
      const firstStepsIncluded = allNew.some((a) => a.id === "first-steps");
      expect(firstStepsIncluded).toBe(true);

      const withUnlocked = checkAchievements(ctx, new Set(["first-steps"]));
      expect(withUnlocked.some((a) => a.id === "first-steps")).toBe(false);
    });

    it("returns empty array when all matching are already unlocked", () => {
      const ctx = makeContext();
      const newlyUnlocked = checkAchievements(ctx, new Set());
      const allIds = new Set(newlyUnlocked.map((a) => a.id));
      const result = checkAchievements(ctx, allIds);
      expect(result).toHaveLength(0);
    });
  });

  describe("predicate tests per category", () => {
    // Speed
    it("Speed Demon unlocks at wpm > 100", () => {
      const ctx = makeContext({ session: { snippetId: "javascript:two-sum", wpm: 101, accuracy: 0.9, elapsedMs: 60000, language: "javascript", difficulty: "easy", lengthCategory: "short", errorCount: 5, totalKeystrokes: 100, correctKeystrokes: 90, history: [] } });
      const found = checkAchievements(ctx, new Set());
      expect(found.some((a) => a.id === "speed-demon")).toBe(true);
    });

    it("Speed Demon does not unlock at wpm <= 100", () => {
      const ctx = makeContext({ session: { snippetId: "javascript:two-sum", wpm: 100, accuracy: 0.9, elapsedMs: 60000, language: "javascript", difficulty: "easy", lengthCategory: "short", errorCount: 5, totalKeystrokes: 100, correctKeystrokes: 90, history: [] } });
      const found = checkAchievements(ctx, new Set());
      expect(found.some((a) => a.id === "speed-demon")).toBe(false);
    });

    // Accuracy
    it("Perfectionist requires accuracy === 1", () => {
      const perfect = makeContext({ session: { snippetId: "javascript:two-sum", wpm: 40, accuracy: 1, elapsedMs: 60000, language: "javascript", difficulty: "easy", lengthCategory: "short", errorCount: 0, totalKeystrokes: 100, correctKeystrokes: 100, history: [] } });
      expect(checkAchievements(perfect, new Set()).some((a) => a.id === "perfectionist")).toBe(true);

      const imperfect = makeContext({ session: { snippetId: "javascript:two-sum", wpm: 40, accuracy: 0.99, elapsedMs: 60000, language: "javascript", difficulty: "easy", lengthCategory: "short", errorCount: 1, totalKeystrokes: 100, correctKeystrokes: 99, history: [] } });
      expect(checkAchievements(imperfect, new Set()).some((a) => a.id === "perfectionist")).toBe(false);
    });

    // Consistency
    it("Daily Driver unlocks at streak >= 7", () => {
      const ctx = makeContext({ streak: { currentStreak: 7, longestStreak: 7, lastActiveDate: "2026-03-04", streakStartDate: "2026-02-26" } });
      expect(checkAchievements(ctx, new Set()).some((a) => a.id === "daily-driver")).toBe(true);
    });

    // Exploration
    it("Polyglot requires 4 languages", () => {
      const ctx = makeContext({
        allSessionLanguages: new Set(["javascript", "python", "java", "cpp"]),
      });
      expect(checkAchievements(ctx, new Set()).some((a) => a.id === "polyglot")).toBe(true);

      const three = makeContext({
        allSessionLanguages: new Set(["javascript", "python", "java"]),
      });
      expect(checkAchievements(three, new Set()).some((a) => a.id === "polyglot")).toBe(false);
    });

    // Milestone
    it("First Steps unlocks on totalSessions >= 1", () => {
      const ctx = makeContext({ stats: { totalSessions: 1, averageWpm: 40, bestWpm: 50, totalTimeMs: 60000 } });
      expect(checkAchievements(ctx, new Set()).some((a) => a.id === "first-steps")).toBe(true);

      const zero = makeContext({ stats: { totalSessions: 0, averageWpm: 0, bestWpm: 0, totalTimeMs: 0 } });
      expect(checkAchievements(zero, new Set()).some((a) => a.id === "first-steps")).toBe(false);
    });

    // Improvement
    it("Personal Best compares against the current session snippet id", () => {
      const ctx = makeContext({
        session: {
          snippetId: "javascript:current-snippet",
          wpm: 82,
          accuracy: 0.93,
          elapsedMs: 60000,
          language: "javascript",
          difficulty: "easy",
          lengthCategory: "short",
          errorCount: 4,
          totalKeystrokes: 100,
          correctKeystrokes: 93,
          history: [],
        },
        recentSessions: [
          {
            id: "latest-other",
            date: "2026-03-04T00:00:00.000Z",
            snippetId: "javascript:other-snippet",
            language: "javascript",
            lengthCategory: "short",
            difficulty: "easy",
            wpm: 150,
            rawWpm: 160,
            accuracy: 0.99,
            elapsedMs: 60000,
            totalKeystrokes: 100,
            correctKeystrokes: 99,
            errorCount: 1,
            history: [],
          },
        ],
        snippetBestWpm: {
          "javascript:current-snippet": 75,
          "javascript:other-snippet": 150,
        },
      });
      expect(checkAchievements(ctx, new Set()).some((a) => a.id === "personal-best")).toBe(true);
    });

    it("Night Owl unlocks for sessions between midnight and 5 AM", () => {
      const ctx = makeContext({ sessionHour: 3 });
      expect(checkAchievements(ctx, new Set()).some((a) => a.id === "night-owl")).toBe(true);

      const day = makeContext({ sessionHour: 14 });
      expect(checkAchievements(day, new Set()).some((a) => a.id === "night-owl")).toBe(false);
    });

    // Challenge
    it("Hard Mode unlocks on hard difficulty", () => {
      const ctx = makeContext({ session: { snippetId: "javascript:two-sum", wpm: 40, accuracy: 0.9, elapsedMs: 60000, language: "javascript", difficulty: "hard", lengthCategory: "short", errorCount: 5, totalKeystrokes: 100, correctKeystrokes: 90, history: [] } });
      expect(checkAchievements(ctx, new Set()).some((a) => a.id === "hard-mode")).toBe(true);
    });

    // Special
    it("Zen Master requires 100% accuracy AND wpm > 100", () => {
      const ctx = makeContext({ session: { snippetId: "javascript:two-sum", wpm: 110, accuracy: 1, elapsedMs: 60000, language: "javascript", difficulty: "easy", lengthCategory: "short", errorCount: 0, totalKeystrokes: 100, correctKeystrokes: 100, history: [] } });
      expect(checkAchievements(ctx, new Set()).some((a) => a.id === "zen-master")).toBe(true);

      const fastOnly = makeContext({ session: { snippetId: "javascript:two-sum", wpm: 110, accuracy: 0.95, elapsedMs: 60000, language: "javascript", difficulty: "easy", lengthCategory: "short", errorCount: 5, totalKeystrokes: 100, correctKeystrokes: 95, history: [] } });
      expect(checkAchievements(fastOnly, new Set()).some((a) => a.id === "zen-master")).toBe(false);
    });
  });
});
