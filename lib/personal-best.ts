/**
 * Personal-best helpers for the result screen and share card.
 *
 * The prior best must be captured BEFORE the just-finished run is persisted,
 * so these comparisons never include the current run. A first run (prior best
 * of 0 or undefined) counts as a new best.
 */

/** True when the current run strictly beats the prior best WPM. */
export function isNewBest(currentWpm: number, priorBestWpm: number | undefined): boolean {
    return currentWpm > (priorBestWpm ?? 0);
}

/** Whole-WPM gain of the current run over the prior best (never negative). */
export function bestDelta(currentWpm: number, priorBestWpm: number | undefined): number {
    const delta = currentWpm - (priorBestWpm ?? 0);
    return delta > 0 ? Math.round(delta) : 0;
}
