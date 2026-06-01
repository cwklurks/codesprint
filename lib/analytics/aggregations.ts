import type { SupportedLanguage, Difficulty, SnippetLength } from "@/lib/snippets";
import { getSessions, type SessionRecord, type SessionFilters } from "@/lib/storage/session-history";

export type TimeRange = "day" | "week" | "month" | "all";

export type WpmDataPoint = {
    date: string;
    wpm: number;
    rawWpm: number;
    accuracy: number;
    sessionCount: number;
};

export type WpmTrend = {
    dataPoints: WpmDataPoint[];
    overallChange: number;
    averageWpm: number;
    peakWpm: number;
    peakDate: string | null;
};

export type LanguageStat = {
    language: SupportedLanguage;
    sessionCount: number;
    totalTimeMs: number;
    averageWpm: number;
    bestWpm: number;
    averageAccuracy: number;
    recentTrend: "improving" | "declining" | "stable";
};

export type PersonalAverages = {
    overallWpm: number;
    overallAccuracy: number;
    totalSessions: number;
    totalTimeMs: number;
    bestWpm: number;
    worstWpm: number;
    byDifficulty: Record<Difficulty, { wpm: number; accuracy: number; sessions: number }>;
    byLength: Record<SnippetLength, { wpm: number; accuracy: number; sessions: number }>;
    improvementRate: number;
};

function getDateRangeStart(range: TimeRange): Date | null {
    if (range === "all") return null;

    const now = new Date();
    switch (range) {
        case "day":
            return new Date(now.getTime() - 24 * 60 * 60 * 1000);
        case "week":
            return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        case "month":
            return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
}

function filterByDateRange(sessions: SessionRecord[], range: TimeRange): SessionRecord[] {
    const rangeStart = getDateRangeStart(range);
    if (!rangeStart) return sessions;

    return sessions.filter((session) => new Date(session.date) >= rangeStart);
}

function formatDateKey(date: Date): string {
    return date.toISOString().split("T")[0];
}

function groupByDate(sessions: SessionRecord[]): Map<string, SessionRecord[]> {
    const groups = new Map<string, SessionRecord[]>();
    for (const session of sessions) {
        const dateKey = formatDateKey(new Date(session.date));
        const existing = groups.get(dateKey);
        if (existing) {
            existing.push(session);
        } else {
            groups.set(dateKey, [session]);
        }
    }
    return groups;
}

function calculateRecentTrend(sessions: SessionRecord[]): "improving" | "declining" | "stable" {
    if (sessions.length < 3) return "stable";

    const sorted = sessions.toSorted((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const midpoint = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, midpoint);
    const secondHalf = sorted.slice(midpoint);

    const firstAvg = firstHalf.reduce((sum, s) => sum + s.wpm, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, s) => sum + s.wpm, 0) / secondHalf.length;

    const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;

    if (changePercent > 5) return "improving";
    if (changePercent < -5) return "declining";
    return "stable";
}

export function getWpmTrends(range: TimeRange = "week", filters?: Omit<SessionFilters, "limit" | "offset">): WpmTrend {
    const allSessions = getSessions(filters);
    const sessions = filterByDateRange(allSessions, range);

    if (sessions.length === 0) {
        return {
            dataPoints: [],
            overallChange: 0,
            averageWpm: 0,
            peakWpm: 0,
            peakDate: null,
        };
    }

    const grouped = groupByDate(sessions);
    const dataPoints: WpmDataPoint[] = [];

    for (const [date, daySessions] of grouped) {
        const wpmSum = daySessions.reduce((sum, s) => sum + s.wpm, 0);
        const rawWpmSum = daySessions.reduce((sum, s) => sum + s.rawWpm, 0);
        const accuracySum = daySessions.reduce((sum, s) => sum + s.accuracy, 0);

        dataPoints.push({
            date,
            wpm: wpmSum / daySessions.length,
            rawWpm: rawWpmSum / daySessions.length,
            accuracy: accuracySum / daySessions.length,
            sessionCount: daySessions.length,
        });
    }

    dataPoints.sort((a, b) => a.date.localeCompare(b.date));

    const peakPoint = dataPoints.reduce((max, point) => (point.wpm > max.wpm ? point : max), dataPoints[0]);

    const overallChange =
        dataPoints.length >= 2
            ? ((dataPoints[dataPoints.length - 1].wpm - dataPoints[0].wpm) / dataPoints[0].wpm) * 100
            : 0;

    const totalWpm = sessions.reduce((sum, s) => sum + s.wpm, 0);

    return {
        dataPoints,
        overallChange,
        averageWpm: totalWpm / sessions.length,
        peakWpm: peakPoint.wpm,
        peakDate: peakPoint.date,
    };
}

export function getLanguageStats(range: TimeRange = "all"): LanguageStat[] {
    const allSessions = getSessions();
    const sessions = filterByDateRange(allSessions, range);

    const byLanguage = new Map<SupportedLanguage, SessionRecord[]>();

    for (const session of sessions) {
        const existing = byLanguage.get(session.language);
        if (existing) {
            existing.push(session);
        } else {
            byLanguage.set(session.language, [session]);
        }
    }

    const stats: LanguageStat[] = [];

    for (const [language, languageSessions] of byLanguage) {
        const totalWpm = languageSessions.reduce((sum, s) => sum + s.wpm, 0);
        const totalAccuracy = languageSessions.reduce((sum, s) => sum + s.accuracy, 0);
        const totalTime = languageSessions.reduce((sum, s) => sum + s.elapsedMs, 0);
        const bestWpm = languageSessions.reduce((max, s) => (s.wpm > max ? s.wpm : max), 0);

        stats.push({
            language,
            sessionCount: languageSessions.length,
            totalTimeMs: totalTime,
            averageWpm: totalWpm / languageSessions.length,
            bestWpm,
            averageAccuracy: totalAccuracy / languageSessions.length,
            recentTrend: calculateRecentTrend(languageSessions),
        });
    }

    return stats.sort((a, b) => b.sessionCount - a.sessionCount);
}

export function getPersonalAverages(range: TimeRange = "all"): PersonalAverages {
    const allSessions = getSessions();
    const sessions = filterByDateRange(allSessions, range);

    const emptyDifficultyStats = (): Record<Difficulty, { wpm: number; accuracy: number; sessions: number }> => ({
        easy: { wpm: 0, accuracy: 0, sessions: 0 },
        medium: { wpm: 0, accuracy: 0, sessions: 0 },
        hard: { wpm: 0, accuracy: 0, sessions: 0 },
    });

    const emptyLengthStats = (): Record<SnippetLength, { wpm: number; accuracy: number; sessions: number }> => ({
        short: { wpm: 0, accuracy: 0, sessions: 0 },
        medium: { wpm: 0, accuracy: 0, sessions: 0 },
        long: { wpm: 0, accuracy: 0, sessions: 0 },
    });

    if (sessions.length === 0) {
        return {
            overallWpm: 0,
            overallAccuracy: 0,
            totalSessions: 0,
            totalTimeMs: 0,
            bestWpm: 0,
            worstWpm: 0,
            byDifficulty: emptyDifficultyStats(),
            byLength: emptyLengthStats(),
            improvementRate: 0,
        };
    }

    const totalWpm = sessions.reduce((sum, s) => sum + s.wpm, 0);
    const totalAccuracy = sessions.reduce((sum, s) => sum + s.accuracy, 0);
    const totalTime = sessions.reduce((sum, s) => sum + s.elapsedMs, 0);
    const bestWpm = sessions.reduce((max, s) => (s.wpm > max ? s.wpm : max), 0);
    const worstWpm = sessions.length > 0 ? sessions.reduce((min, s) => (s.wpm < min ? s.wpm : min), Infinity) : 0;

    const byDifficulty = emptyDifficultyStats();
    const byLength = emptyLengthStats();

    const difficultyAccum: Record<Difficulty, { wpmSum: number; accSum: number; count: number }> = {
        easy: { wpmSum: 0, accSum: 0, count: 0 },
        medium: { wpmSum: 0, accSum: 0, count: 0 },
        hard: { wpmSum: 0, accSum: 0, count: 0 },
    };

    const lengthAccum: Record<SnippetLength, { wpmSum: number; accSum: number; count: number }> = {
        short: { wpmSum: 0, accSum: 0, count: 0 },
        medium: { wpmSum: 0, accSum: 0, count: 0 },
        long: { wpmSum: 0, accSum: 0, count: 0 },
    };

    for (const session of sessions) {
        difficultyAccum[session.difficulty].wpmSum += session.wpm;
        difficultyAccum[session.difficulty].accSum += session.accuracy;
        difficultyAccum[session.difficulty].count += 1;

        lengthAccum[session.lengthCategory].wpmSum += session.wpm;
        lengthAccum[session.lengthCategory].accSum += session.accuracy;
        lengthAccum[session.lengthCategory].count += 1;
    }

    for (const difficulty of ["easy", "medium", "hard"] as Difficulty[]) {
        const accum = difficultyAccum[difficulty];
        if (accum.count > 0) {
            byDifficulty[difficulty] = {
                wpm: accum.wpmSum / accum.count,
                accuracy: accum.accSum / accum.count,
                sessions: accum.count,
            };
        }
    }

    for (const length of ["short", "medium", "long"] as SnippetLength[]) {
        const accum = lengthAccum[length];
        if (accum.count > 0) {
            byLength[length] = {
                wpm: accum.wpmSum / accum.count,
                accuracy: accum.accSum / accum.count,
                sessions: accum.count,
            };
        }
    }

    const trend = calculateRecentTrend(sessions);
    const improvementRate = trend === "improving" ? 1 : trend === "declining" ? -1 : 0;

    return {
        overallWpm: totalWpm / sessions.length,
        overallAccuracy: totalAccuracy / sessions.length,
        totalSessions: sessions.length,
        totalTimeMs: totalTime,
        bestWpm,
        worstWpm,
        byDifficulty,
        byLength,
        improvementRate,
    };
}

export function getSnippetPerformance(snippetId: string): {
    attempts: number;
    bestWpm: number;
    averageWpm: number;
    averageAccuracy: number;
    improvement: number;
} {
    const sessions = getSessions({ snippetId });

    if (sessions.length === 0) {
        return {
            attempts: 0,
            bestWpm: 0,
            averageWpm: 0,
            averageAccuracy: 0,
            improvement: 0,
        };
    }

    const totalWpm = sessions.reduce((sum, s) => sum + s.wpm, 0);
    const totalAccuracy = sessions.reduce((sum, s) => sum + s.accuracy, 0);
    const bestWpm = sessions.reduce((max, s) => (s.wpm > max ? s.wpm : max), 0);

    const sorted = sessions.toSorted((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const improvement =
        sorted.length >= 2 ? ((sorted[sorted.length - 1].wpm - sorted[0].wpm) / sorted[0].wpm) * 100 : 0;

    return {
        attempts: sessions.length,
        bestWpm,
        averageWpm: totalWpm / sessions.length,
        averageAccuracy: totalAccuracy / sessions.length,
        improvement,
    };
}

export function getProgressOverTime(
    range: TimeRange = "month"
): { date: string; cumulativeAvgWpm: number; cumulativeSessions: number }[] {
    const allSessions = getSessions();
    const sessions = filterByDateRange(allSessions, range);

    if (sessions.length === 0) return [];

    const sorted = sessions.toSorted((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const grouped = groupByDate(sorted);

    const result: { date: string; cumulativeAvgWpm: number; cumulativeSessions: number }[] = [];
    let cumulativeWpm = 0;
    let cumulativeCount = 0;

    const sortedDates = Array.from(grouped.keys()).sort();

    for (const date of sortedDates) {
        const daySessions = grouped.get(date) ?? [];
        cumulativeWpm += daySessions.reduce((sum, s) => sum + s.wpm, 0);
        cumulativeCount += daySessions.length;

        result.push({
            date,
            cumulativeAvgWpm: cumulativeWpm / cumulativeCount,
            cumulativeSessions: cumulativeCount,
        });
    }

    return result;
}
