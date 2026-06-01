/**
 * Single source of truth for the WPM percentile shown to the user.
 *
 * Previously the result screen (logistic curve) and the shareable card (a coarse
 * step function) computed this separately, so the same run could read "79% faster"
 * on screen and "Top 30%" on the downloaded card. Both surfaces now call this.
 *
 * Returns the percentile RANK (1-99): "faster than N% of coders". The share card
 * renders the complement, `Top ${100 - computePercentile(wpm)}%`.
 */
export function computePercentile(wpm: number): number {
    // Logistic CDF over a typical typing-speed distribution (center 45, scale 18).
    const p = 1 / (1 + Math.exp(-1.6 * (wpm - 45) / 18));
    return Math.min(99, Math.max(1, Math.round(p * 100)));
}
