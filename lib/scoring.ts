"use client";

export type Metrics = {
    rawWpm: number;
    adjustedWpm: number;
    accuracy: number;
};

const MS_IN_MINUTE = 1000 * 60;

type ComputeMetricsInput = {
    correctProgress: number;
    elapsedMs: number;
    totalTyped: number;
};

export function computeMetrics({ correctProgress, elapsedMs, totalTyped }: ComputeMetricsInput): Metrics {
    if (elapsedMs <= 0 || totalTyped <= 0) {
        return { rawWpm: 0, adjustedWpm: 0, accuracy: totalTyped === 0 ? 1 : 0 };
    }
    const minutes = elapsedMs / MS_IN_MINUTE;
    const rawWpm = totalTyped / 5 / minutes;
    // Use correctProgress (net useful characters) for adjusted speed
    const adjustedWpm = Math.max(0, (correctProgress / 5) / minutes);
    const accuracy =
        correctProgress <= 0 || totalTyped <= 0 ? 0 : Math.min(1, correctProgress / totalTyped);
    return {
        rawWpm,
        adjustedWpm,
        accuracy,
    };
}
