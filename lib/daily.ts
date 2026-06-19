import { getSiteUrl } from "./site";
import type { Snippet } from "./snippets";

const EPOCH = "2024-01-01";
const MS_PER_DAY = 86_400_000;

function parseDateString(dateStr: string): Date {
    const [year, month, day] = dateStr.split("-").map(Number);
    return new Date(year, month - 1, day);
}

function daysBetween(dateStrA: string, dateStrB: string): number {
    const a = parseDateString(dateStrA);
    const b = parseDateString(dateStrB);
    return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

// Integer day index since the fixed epoch, 1-based so the epoch is "Daily #1".
export function getDailyNumber(dateStr: string): number {
    return daysBetween(EPOCH, dateStr) + 1;
}

function pad2(value: number): string {
    return String(value).padStart(2, "0");
}

// Exact inverse of getDailyNumber: returns the local "YYYY-MM-DD" date string for
// daily #n (so #1 maps back to the EPOCH "2024-01-01"). Uses the same local-date
// semantics as parseDateString, so add-days then read local Y/M/D back out.
export function getDateForDailyNumber(dayNumber: number): string {
    const epoch = parseDateString(EPOCH);
    const date = new Date(epoch.getFullYear(), epoch.getMonth(), epoch.getDate() + (dayNumber - 1));
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

// Stable 32-bit djb2 string hash; deterministic across machines and runs.
function hashString(value: string): number {
    let hash = 5381;
    for (let i = 0; i < value.length; i++) {
        hash = (hash * 33) ^ value.charCodeAt(i);
    }
    return hash >>> 0;
}

// Deterministic: same date + same pool => same snippet for everyone.
export function pickDailySnippet(dateStr: string, snippets: Snippet[]): Snippet | null {
    if (snippets.length === 0) return null;
    const sorted = [...snippets].sort((a, b) => a.id.localeCompare(b.id));
    const index = hashString(dateStr) % sorted.length;
    return sorted[index];
}

type DailyShareOptions = {
    dateStr: string;
    dayNumber: number;
    wpm: number;
    accuracy: number;
    // Accepted for API compatibility; no longer rendered in the share signature.
    patternScore?: number;
    streak: number;
    language: string;
};

const BAR_CELLS = 15;
const BAR_FILLED = "█"; // █
const BAR_EMPTY = "░"; // ░

const LANGUAGE_CODES: Record<string, string> = {
    javascript: "js",
    python: "py",
    java: "java",
    cpp: "cpp",
};

// Short language code for the share signature; unknown languages keep their first 4 chars.
function languageCode(language: string): string {
    return LANGUAGE_CODES[language] ?? language.slice(0, 4);
}

// 15-cell bar with fill proportional to wpm capped at 100.
function wpmBar(wpm: number): string {
    const filled = Math.max(
        0,
        Math.min(BAR_CELLS, Math.round((Math.min(wpm, 100) / 100) * BAR_CELLS))
    );
    return BAR_FILLED.repeat(filled) + BAR_EMPTY.repeat(BAR_CELLS - filled);
}

// Four-line, spoiler-free, single-emoji copy-paste signature with a real daily URL.
export function formatDailyShare(opts: DailyShareOptions): string {
    const langCode = languageCode(opts.language);
    const wpm = Math.round(opts.wpm);
    const accPercent = Math.round(opts.accuracy * 100);
    const url = `${getSiteUrl()}/daily/${opts.dayNumber}?w=${wpm}&a=${accPercent}&s=${opts.streak}&l=${langCode}`;
    const lines = [
        `CodeSprint #${opts.dayNumber} ${langCode}`,
        `${wpmBar(opts.wpm)} ${wpm} wpm`,
        `${accPercent}% acc · 🔥 ${opts.streak}`,
        url,
    ];
    return lines.join("\n");
}
