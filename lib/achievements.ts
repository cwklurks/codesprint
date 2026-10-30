import type { StreakState } from "./streaks";
import type { SessionRecord } from "./storage/session-history";
import type { SupportedLanguage, SnippetLength, Difficulty } from "./snippets";
import type { HistoryEntry } from "@/hooks/useTypingEngine";

export type AchievementRarity = "common" | "rare" | "epic" | "legendary";
export type AchievementCategory =
  | "speed"
  | "accuracy"
  | "consistency"
  | "exploration"
  | "milestone"
  | "improvement"
  | "challenge"
  | "special";

export type AchievementContext = {
  session: {
    snippetId: string;
    wpm: number;
    accuracy: number;
    elapsedMs: number;
    language: SupportedLanguage;
    difficulty: Difficulty;
    lengthCategory: SnippetLength;
    errorCount: number;
    totalKeystrokes: number;
    correctKeystrokes: number;
    patternScore?: number;
    history: HistoryEntry[];
  };
  stats: {
    totalSessions: number;
    averageWpm: number;
    bestWpm: number;
    totalTimeMs: number;
  };
  recentSessions: SessionRecord[];
  allSessionLanguages: Set<string>;
  sessionsPerLanguage: Record<string, number>;
  streak: StreakState;
  level: number;
  vimModeSessionCount: number;
  themesUsed: number;
  sessionHour: number;
  consecutiveHighAccuracySessions: number;
  snippetBestWpm: Record<string, number>;
};

export type AchievementDefinition = {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  icon: string;
  predicate: (ctx: AchievementContext) => boolean;
};

export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  // ── Speed (6) ──────────────────────────────────────────────
  {
    id: "warm-up",
    name: "Warm Up",
    description: "Complete a session with over 50 WPM",
    category: "speed",
    rarity: "common",
    icon: "🔥",
    predicate: (ctx) => ctx.session.wpm > 50,
  },
  {
    id: "speed-demon",
    name: "Speed Demon",
    description: "Reach 100 WPM in a session",
    category: "speed",
    rarity: "rare",
    icon: "👹",
    predicate: (ctx) => ctx.session.wpm > 100,
  },
  {
    id: "lightning-fingers",
    name: "Lightning Fingers",
    description: "Reach 120 WPM in a session",
    category: "speed",
    rarity: "epic",
    icon: "⚡",
    predicate: (ctx) => ctx.session.wpm > 120,
  },
  {
    id: "supersonic",
    name: "Supersonic",
    description: "Reach 150 WPM in a session",
    category: "speed",
    rarity: "legendary",
    icon: "🚀",
    predicate: (ctx) => ctx.session.wpm > 150,
  },
  {
    id: "quick-draw",
    name: "Quick Draw",
    description: "Score over 80 WPM on a hard snippet",
    category: "speed",
    rarity: "rare",
    icon: "🤠",
    predicate: (ctx) =>
      ctx.session.wpm > 80 && ctx.session.difficulty === "hard",
  },
  {
    id: "blitz",
    name: "Blitz",
    description: "Score over 60 WPM on a long snippet",
    category: "speed",
    rarity: "rare",
    icon: "💨",
    predicate: (ctx) =>
      ctx.session.wpm > 60 && ctx.session.lengthCategory === "long",
  },

  // ── Accuracy (5) ───────────────────────────────────────────
  {
    id: "perfectionist",
    name: "Perfectionist",
    description: "Achieve 100% accuracy in a session",
    category: "accuracy",
    rarity: "epic",
    icon: "💎",
    predicate: (ctx) => ctx.session.accuracy === 1,
  },
  {
    id: "sharpshooter",
    name: "Sharpshooter",
    description: "Achieve over 98% accuracy in a session",
    category: "accuracy",
    rarity: "rare",
    icon: "🎯",
    predicate: (ctx) => ctx.session.accuracy > 0.98,
  },
  {
    id: "precision-streak",
    name: "Precision Streak",
    description: "Maintain over 95% accuracy for 5 consecutive sessions",
    category: "accuracy",
    rarity: "epic",
    icon: "🏹",
    predicate: (ctx) => ctx.consecutiveHighAccuracySessions >= 5,
  },
  {
    id: "zero-errors",
    name: "Zero Errors",
    description: "Complete a session with zero errors",
    category: "accuracy",
    rarity: "rare",
    icon: "✨",
    predicate: (ctx) => ctx.session.errorCount === 0,
  },
  {
    id: "syntax-master",
    name: "Syntax Master",
    description: "Achieve a pattern score above 95",
    category: "accuracy",
    rarity: "epic",
    icon: "🧬",
    predicate: (ctx) =>
      ctx.session.patternScore !== undefined && ctx.session.patternScore > 95,
  },

  // ── Consistency (6) ────────────────────────────────────────
  {
    id: "habitual",
    name: "Habitual",
    description: "Maintain a 3-day streak",
    category: "consistency",
    rarity: "common",
    icon: "📅",
    predicate: (ctx) => ctx.streak.currentStreak >= 3,
  },
  {
    id: "daily-driver",
    name: "Daily Driver",
    description: "Maintain a 7-day streak",
    category: "consistency",
    rarity: "rare",
    icon: "🗓️",
    predicate: (ctx) => ctx.streak.currentStreak >= 7,
  },
  {
    id: "streak-master",
    name: "Streak Master",
    description: "Maintain a 30-day streak",
    category: "consistency",
    rarity: "legendary",
    icon: "🔥",
    predicate: (ctx) => ctx.streak.currentStreak >= 30,
  },
  {
    id: "marathon",
    name: "Marathon",
    description: "Accumulate over 1 hour of total typing time",
    category: "consistency",
    rarity: "rare",
    icon: "🏃",
    predicate: (ctx) => ctx.stats.totalTimeMs > 3600000,
  },
  {
    id: "dedicated",
    name: "Dedicated",
    description: "Complete 50 sessions",
    category: "consistency",
    rarity: "rare",
    icon: "💪",
    predicate: (ctx) => ctx.stats.totalSessions >= 50,
  },
  {
    id: "centurion",
    name: "Centurion",
    description: "Complete 100 sessions",
    category: "consistency",
    rarity: "epic",
    icon: "🏛️",
    predicate: (ctx) => ctx.stats.totalSessions >= 100,
  },

  // ── Exploration (6) ────────────────────────────────────────
  {
    id: "bilingual",
    name: "Bilingual",
    description: "Complete sessions in 2 different languages",
    category: "exploration",
    rarity: "common",
    icon: "🌐",
    predicate: (ctx) => ctx.allSessionLanguages.size >= 2,
  },
  {
    id: "polyglot",
    name: "Polyglot",
    description: "Complete sessions in all 6 languages",
    category: "exploration",
    rarity: "epic",
    icon: "🗺️",
    predicate: (ctx) => ctx.allSessionLanguages.size >= 6,
  },
  {
    id: "python-pro",
    name: "Python Pro",
    description: "Complete 20 Python sessions",
    category: "exploration",
    rarity: "rare",
    icon: "🐍",
    predicate: (ctx) => (ctx.sessionsPerLanguage["python"] ?? 0) >= 20,
  },
  {
    id: "js-ninja",
    name: "JS Ninja",
    description: "Complete 20 JavaScript sessions",
    category: "exploration",
    rarity: "rare",
    icon: "🥷",
    predicate: (ctx) => (ctx.sessionsPerLanguage["javascript"] ?? 0) >= 20,
  },
  {
    id: "java-journey",
    name: "Java Journey",
    description: "Complete 20 Java sessions",
    category: "exploration",
    rarity: "rare",
    icon: "☕",
    predicate: (ctx) => (ctx.sessionsPerLanguage["java"] ?? 0) >= 20,
  },
  {
    id: "cpp-warrior",
    name: "C++ Warrior",
    description: "Complete 20 C++ sessions",
    category: "exploration",
    rarity: "rare",
    icon: "⚔️",
    predicate: (ctx) => (ctx.sessionsPerLanguage["cpp"] ?? 0) >= 20,
  },

  // ── Milestone (5) ──────────────────────────────────────────
  {
    id: "first-steps",
    name: "First Steps",
    description: "Complete your first session",
    category: "milestone",
    rarity: "common",
    icon: "👣",
    predicate: (ctx) => ctx.stats.totalSessions >= 1,
  },
  {
    id: "getting-started",
    name: "Getting Started",
    description: "Complete 10 sessions",
    category: "milestone",
    rarity: "common",
    icon: "🎬",
    predicate: (ctx) => ctx.stats.totalSessions >= 10,
  },
  {
    id: "level-5",
    name: "Level 5",
    description: "Reach level 5",
    category: "milestone",
    rarity: "common",
    icon: "⭐",
    predicate: (ctx) => ctx.level >= 5,
  },
  {
    id: "level-10",
    name: "Level 10",
    description: "Reach level 10",
    category: "milestone",
    rarity: "rare",
    icon: "🌟",
    predicate: (ctx) => ctx.level >= 10,
  },
  {
    id: "level-20",
    name: "Level 20",
    description: "Reach level 20",
    category: "milestone",
    rarity: "epic",
    icon: "💫",
    predicate: (ctx) => ctx.level >= 20,
  },

  // ── Improvement (5) ────────────────────────────────────────
  {
    id: "personal-best",
    name: "Personal Best",
    description: "Beat your best WPM on a snippet you've typed before",
    category: "improvement",
    rarity: "rare",
    icon: "🏆",
    predicate: (ctx) => {
      const prevBest = ctx.snippetBestWpm[ctx.session.snippetId];
      return prevBest !== undefined && ctx.session.wpm > prevBest;
    },
  },
  {
    id: "improving",
    name: "Improving",
    description:
      "Average WPM of your last 5 sessions exceeds your previous 5",
    category: "improvement",
    rarity: "rare",
    icon: "📈",
    predicate: (ctx) => {
      if (ctx.recentSessions.length < 10) return false;
      const last5 = ctx.recentSessions.slice(0, 5);
      const prev5 = ctx.recentSessions.slice(5, 10);
      const avgLast = last5.reduce((s, r) => s + r.wpm, 0) / 5;
      const avgPrev = prev5.reduce((s, r) => s + r.wpm, 0) / 5;
      return avgLast > avgPrev;
    },
  },
  {
    id: "comeback",
    name: "Comeback",
    description: "After breaking a streak, score above your average WPM",
    category: "improvement",
    rarity: "rare",
    icon: "🔄",
    predicate: (ctx) =>
      ctx.streak.currentStreak === 1 &&
      ctx.streak.longestStreak > 1 &&
      ctx.session.wpm > ctx.stats.averageWpm,
  },
  {
    id: "night-owl",
    name: "Night Owl",
    description: "Complete a session between midnight and 5 AM",
    category: "improvement",
    rarity: "rare",
    icon: "🦉",
    predicate: (ctx) => ctx.sessionHour >= 0 && ctx.sessionHour < 5,
  },
  {
    id: "early-bird",
    name: "Early Bird",
    description: "Complete a session between 5 AM and 8 AM",
    category: "improvement",
    rarity: "rare",
    icon: "🐦",
    predicate: (ctx) => ctx.sessionHour >= 5 && ctx.sessionHour < 8,
  },

  // ── Challenge (5) ──────────────────────────────────────────
  {
    id: "hard-mode",
    name: "Hard Mode",
    description: "Complete a hard difficulty snippet",
    category: "challenge",
    rarity: "common",
    icon: "💀",
    predicate: (ctx) => ctx.session.difficulty === "hard",
  },
  {
    id: "long-haul",
    name: "Long Haul",
    description: "Complete a long snippet",
    category: "challenge",
    rarity: "common",
    icon: "📜",
    predicate: (ctx) => ctx.session.lengthCategory === "long",
  },
  {
    id: "vim-master",
    name: "Vim Master",
    description: "Complete 10 sessions with Vim mode enabled",
    category: "challenge",
    rarity: "epic",
    icon: "🖥️",
    predicate: (ctx) => ctx.vimModeSessionCount >= 10,
  },
  {
    id: "theme-explorer",
    name: "Theme Explorer",
    description: "Use 5 or more different themes",
    category: "challenge",
    rarity: "rare",
    icon: "🎨",
    predicate: (ctx) => ctx.themesUsed >= 5,
  },
  {
    id: "speed-on-hard",
    name: "Speed on Hard",
    description: "Score over 80 WPM on a hard difficulty snippet",
    category: "challenge",
    rarity: "epic",
    icon: "🏎️",
    predicate: (ctx) =>
      ctx.session.wpm > 80 && ctx.session.difficulty === "hard",
  },

  // ── Special (2) ────────────────────────────────────────────
  {
    id: "zen-master",
    name: "Zen Master",
    description: "Achieve 100% accuracy with over 100 WPM",
    category: "special",
    rarity: "legendary",
    icon: "🧘",
    predicate: (ctx) => ctx.session.accuracy === 1 && ctx.session.wpm > 100,
  },
  {
    id: "legendary",
    name: "Legendary",
    description:
      "Achieve 150+ WPM with 100% accuracy on a hard difficulty snippet",
    category: "special",
    rarity: "legendary",
    icon: "👑",
    predicate: (ctx) =>
      ctx.session.wpm > 150 &&
      ctx.session.accuracy === 1 &&
      ctx.session.difficulty === "hard",
  },
] as const;

export function checkAchievements(
  ctx: AchievementContext,
  alreadyUnlocked: Set<string>,
): AchievementDefinition[] {
  return ACHIEVEMENTS.filter(
    (a) => !alreadyUnlocked.has(a.id) && a.predicate(ctx),
  );
}
