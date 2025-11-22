"use client";

export type Metrics = {
    rawWpm: number;
    adjustedWpm: number;
    accuracy: number;
};

const MS_IN_MINUTE = 1000 * 60;

type ComputeMetricsInput = {
    correctProgress: number; // Characters in perfect words
    elapsedMs: number;
    totalTyped: number; // Total characters currently in the buffer (cursor position) - kept for legacy/other uses
    totalKeystrokes?: number; // Total keys pressed (including backspaces)
    correctKeystrokes?: number; // Total correct keys pressed
};

export function computeMetrics({ correctProgress, elapsedMs, totalTyped, totalKeystrokes, correctKeystrokes }: ComputeMetricsInput): Metrics {
    if (elapsedMs <= 0) {
        return { rawWpm: 0, adjustedWpm: 0, accuracy: 1 };
    }
    const minutes = elapsedMs / MS_IN_MINUTE;

    // Raw WPM: (Total Keystrokes / 5) / Time
    // We use totalKeystrokes if available, otherwise fallback to totalTyped (backward compatibility/safety)
    const rawCount = totalKeystrokes ?? totalTyped;
    const rawWpm = (rawCount / 5) / minutes;

    // Adjusted WPM: (Characters in Perfect Words / 5) / Time
    // correctProgress now represents "sum of lengths of perfect words"
    const adjustedWpm = Math.max(0, (correctProgress / 5) / minutes);

    // Accuracy: Correct Keystrokes / Total Keystrokes
    const accuracy =
        !totalKeystrokes || totalKeystrokes <= 0
            ? 1
            : Math.min(1, (correctKeystrokes ?? correctProgress) / totalKeystrokes);

    return {
        rawWpm,
        adjustedWpm,
        accuracy,
    };
}
