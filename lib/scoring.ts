"use client";

export type Metrics = {
    rawWpm: number;
    adjustedWpm: number;
    acc: number;
};

const MS_IN_MINUTE = 1000 * 60;

type ComputeMetricsInput = {
    correctProgress: number;
    elapsedMs: number;
    totalTyped: number;
    errors: number;
};

export function computeMetrics({ correctProgress, elapsedMs, totalTyped, errors }: ComputeMetricsInput): Metrics {
    if (elapsedMs <= 0 || totalTyped <= 0) {
        return { rawWpm: 0, adjustedWpm: 0, acc: totalTyped === 0 ? 1 : 0 };
    }
    const minutes = elapsedMs / MS_IN_MINUTE;
    const rawWpm = totalTyped / 5 / minutes;
    const netWords = totalTyped / 5 - errors;
    const adjustedWpm = Math.max(0, netWords / minutes);
    const accuracy =
        correctProgress <= 0 || totalTyped <= 0 ? 0 : Math.min(1, correctProgress / totalTyped);
    return {
        rawWpm,
        adjustedWpm,
        acc: accuracy,
    };
}
