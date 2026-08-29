import { describe, it, expect } from "vitest";
import type { WpmTrend, LanguageStat, PersonalAverages } from "@/lib/analytics/aggregations";
import type { SupportedLanguage } from "@/lib/snippets";
import { TIME_RANGE_OPTIONS } from "@/components/analytics/AnalyticsDashboard";

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
    javascript: "JavaScript",
    python: "Python",
    java: "Java",
    cpp: "C++",
};

function formatDuration(ms: number): string {
    if (ms <= 0) return "0s";
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds.toFixed(0)}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function formatTrend(value: number): { text: string; color: string } {
    if (value > 5) return { text: `+${value.toFixed(1)}%`, color: "var(--success)" };
    if (value < -5) return { text: `${value.toFixed(1)}%`, color: "var(--error)" };
    return { text: "Stable", color: "var(--text-subtle)" };
}

describe("AnalyticsDashboard utilities", () => {
    describe("TIME_RANGE_OPTIONS", () => {
        it("should have all expected time range options", () => {
            expect(TIME_RANGE_OPTIONS).toHaveLength(4);
            expect(TIME_RANGE_OPTIONS.map((o) => o.value)).toEqual(["day", "week", "month", "all"]);
        });

        it("should have human-readable labels", () => {
            expect(TIME_RANGE_OPTIONS[0].label).toBe("24h");
            expect(TIME_RANGE_OPTIONS[1].label).toBe("Week");
            expect(TIME_RANGE_OPTIONS[2].label).toBe("Month");
            expect(TIME_RANGE_OPTIONS[3].label).toBe("All time");
        });
    });

    describe("LANGUAGE_LABELS", () => {
        it("should map all supported languages to display names", () => {
            expect(LANGUAGE_LABELS.javascript).toBe("JavaScript");
            expect(LANGUAGE_LABELS.python).toBe("Python");
            expect(LANGUAGE_LABELS.java).toBe("Java");
            expect(LANGUAGE_LABELS.cpp).toBe("C++");
        });
    });

    describe("formatDuration", () => {
        it("should return 0s for zero or negative values", () => {
            expect(formatDuration(0)).toBe("0s");
            expect(formatDuration(-100)).toBe("0s");
        });

        it("should format seconds correctly", () => {
            expect(formatDuration(5000)).toBe("5s");
            expect(formatDuration(30000)).toBe("30s");
            expect(formatDuration(59000)).toBe("59s");
        });

        it("should format minutes correctly", () => {
            expect(formatDuration(60000)).toBe("1m");
            expect(formatDuration(120000)).toBe("2m");
            expect(formatDuration(300000)).toBe("5m");
            expect(formatDuration(3540000)).toBe("59m");
        });

        it("should format hours correctly", () => {
            expect(formatDuration(3600000)).toBe("1h");
            expect(formatDuration(7200000)).toBe("2h");
        });

        it("should format hours and minutes correctly", () => {
            expect(formatDuration(3660000)).toBe("1h 1m");
            expect(formatDuration(5400000)).toBe("1h 30m");
            expect(formatDuration(9000000)).toBe("2h 30m");
        });
    });

    describe("formatTrend", () => {
        it("should format positive trends with + prefix", () => {
            const result = formatTrend(10);
            expect(result.text).toBe("+10.0%");
            expect(result.color).toBe("var(--success)");
        });

        it("should format large positive trends", () => {
            const result = formatTrend(50.5);
            expect(result.text).toBe("+50.5%");
            expect(result.color).toBe("var(--success)");
        });

        it("should format negative trends without + prefix", () => {
            const result = formatTrend(-10);
            expect(result.text).toBe("-10.0%");
            expect(result.color).toBe("var(--error)");
        });

        it("should format large negative trends", () => {
            const result = formatTrend(-25.3);
            expect(result.text).toBe("-25.3%");
            expect(result.color).toBe("var(--error)");
        });

        it("should return Stable for small positive changes", () => {
            const result = formatTrend(3);
            expect(result.text).toBe("Stable");
            expect(result.color).toBe("var(--text-subtle)");
        });

        it("should return Stable for small negative changes", () => {
            const result = formatTrend(-3);
            expect(result.text).toBe("Stable");
            expect(result.color).toBe("var(--text-subtle)");
        });

        it("should return Stable for zero change", () => {
            const result = formatTrend(0);
            expect(result.text).toBe("Stable");
            expect(result.color).toBe("var(--text-subtle)");
        });

        it("should return Stable at boundary value of 5", () => {
            const result = formatTrend(5);
            expect(result.text).toBe("Stable");
        });

        it("should return Stable at boundary value of -5", () => {
            const result = formatTrend(-5);
            expect(result.text).toBe("Stable");
        });

        it("should format positive trend just above threshold", () => {
            const result = formatTrend(5.1);
            expect(result.text).toBe("+5.1%");
            expect(result.color).toBe("var(--success)");
        });

        it("should format negative trend just below threshold", () => {
            const result = formatTrend(-5.1);
            expect(result.text).toBe("-5.1%");
            expect(result.color).toBe("var(--error)");
        });
    });
});

describe("AnalyticsDashboard data types", () => {
    describe("WpmTrend type", () => {
        it("should accept valid empty WPM trend data", () => {
            const emptyTrend: WpmTrend = {
                dataPoints: [],
                overallChange: 0,
                averageWpm: 0,
                peakWpm: 0,
                peakDate: null,
            };

            expect(emptyTrend.dataPoints).toHaveLength(0);
            expect(emptyTrend.peakDate).toBeNull();
        });

        it("should accept valid WPM trend data with data points", () => {
            const trend: WpmTrend = {
                dataPoints: [
                    { date: "2025-01-20", wpm: 60, rawWpm: 65, accuracy: 0.92, sessionCount: 3 },
                    { date: "2025-01-21", wpm: 75, rawWpm: 80, accuracy: 0.94, sessionCount: 2 },
                ],
                overallChange: 25,
                averageWpm: 67.5,
                peakWpm: 75,
                peakDate: "2025-01-21",
            };

            expect(trend.dataPoints).toHaveLength(2);
            expect(trend.peakWpm).toBe(75);
        });
    });

    describe("LanguageStat type", () => {
        it("should accept valid language statistics", () => {
            const stat: LanguageStat = {
                language: "javascript",
                sessionCount: 10,
                totalTimeMs: 300000,
                averageWpm: 65,
                bestWpm: 85,
                averageAccuracy: 0.93,
                recentTrend: "improving",
            };

            expect(stat.language).toBe("javascript");
            expect(stat.recentTrend).toBe("improving");
        });

        it("should accept declining trend", () => {
            const stat: LanguageStat = {
                language: "python",
                sessionCount: 5,
                totalTimeMs: 150000,
                averageWpm: 55,
                bestWpm: 70,
                averageAccuracy: 0.88,
                recentTrend: "declining",
            };

            expect(stat.recentTrend).toBe("declining");
        });

        it("should accept stable trend", () => {
            const stat: LanguageStat = {
                language: "java",
                sessionCount: 3,
                totalTimeMs: 90000,
                averageWpm: 50,
                bestWpm: 55,
                averageAccuracy: 0.9,
                recentTrend: "stable",
            };

            expect(stat.recentTrend).toBe("stable");
        });
    });

    describe("PersonalAverages type", () => {
        it("should accept valid personal averages data", () => {
            const averages: PersonalAverages = {
                overallWpm: 65,
                overallAccuracy: 0.92,
                totalSessions: 25,
                totalTimeMs: 750000,
                bestWpm: 95,
                worstWpm: 40,
                byDifficulty: {
                    easy: { wpm: 75, accuracy: 0.95, sessions: 10 },
                    medium: { wpm: 65, accuracy: 0.92, sessions: 10 },
                    hard: { wpm: 55, accuracy: 0.88, sessions: 5 },
                },
                byLength: {
                    short: { wpm: 80, accuracy: 0.96, sessions: 8 },
                    medium: { wpm: 65, accuracy: 0.92, sessions: 12 },
                    long: { wpm: 55, accuracy: 0.88, sessions: 5 },
                },
                improvementRate: 1,
            };

            expect(averages.totalSessions).toBe(25);
            expect(averages.byDifficulty.easy.sessions).toBe(10);
            expect(averages.byLength.short.wpm).toBe(80);
        });

        it("should accept zero stats for unused categories", () => {
            const averages: PersonalAverages = {
                overallWpm: 60,
                overallAccuracy: 0.9,
                totalSessions: 5,
                totalTimeMs: 150000,
                bestWpm: 70,
                worstWpm: 50,
                byDifficulty: {
                    easy: { wpm: 60, accuracy: 0.9, sessions: 5 },
                    medium: { wpm: 0, accuracy: 0, sessions: 0 },
                    hard: { wpm: 0, accuracy: 0, sessions: 0 },
                },
                byLength: {
                    short: { wpm: 60, accuracy: 0.9, sessions: 5 },
                    medium: { wpm: 0, accuracy: 0, sessions: 0 },
                    long: { wpm: 0, accuracy: 0, sessions: 0 },
                },
                improvementRate: 0,
            };

            expect(averages.byDifficulty.medium.sessions).toBe(0);
            expect(averages.byLength.long.sessions).toBe(0);
        });

        it("should accept negative improvement rate", () => {
            const averages: PersonalAverages = {
                overallWpm: 50,
                overallAccuracy: 0.85,
                totalSessions: 10,
                totalTimeMs: 300000,
                bestWpm: 70,
                worstWpm: 35,
                byDifficulty: {
                    easy: { wpm: 50, accuracy: 0.85, sessions: 10 },
                    medium: { wpm: 0, accuracy: 0, sessions: 0 },
                    hard: { wpm: 0, accuracy: 0, sessions: 0 },
                },
                byLength: {
                    short: { wpm: 50, accuracy: 0.85, sessions: 10 },
                    medium: { wpm: 0, accuracy: 0, sessions: 0 },
                    long: { wpm: 0, accuracy: 0, sessions: 0 },
                },
                improvementRate: -1,
            };

            expect(averages.improvementRate).toBe(-1);
        });
    });
});

describe("AnalyticsDashboard edge cases", () => {
    describe("duration formatting edge cases", () => {
        it("should handle very small durations", () => {
            expect(formatDuration(100)).toBe("0s");
            expect(formatDuration(999)).toBe("1s");
        });

        it("should handle very large durations", () => {
            expect(formatDuration(86400000)).toBe("24h");
            expect(formatDuration(90000000)).toBe("25h");
        });
    });

    describe("trend formatting edge cases", () => {
        it("should handle very large positive trends", () => {
            const result = formatTrend(1000);
            expect(result.text).toBe("+1000.0%");
        });

        it("should handle very large negative trends", () => {
            const result = formatTrend(-1000);
            expect(result.text).toBe("-1000.0%");
        });

        it("should handle fractional trends", () => {
            expect(formatTrend(10.123).text).toBe("+10.1%");
            expect(formatTrend(-10.567).text).toBe("-10.6%");
        });
    });
});
