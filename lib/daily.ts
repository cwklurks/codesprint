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
    patternScore?: number;
    streak: number;
    language: string;
};

// Compact Wordle-style copy-paste block. No snippet contents or spoilers.
export function formatDailyShare(opts: DailyShareOptions): string {
    const accuracyPercent = Math.round(opts.accuracy * 100);
    const lines = [
        `CodeSprint Daily #${opts.dayNumber}`,
        `⚡ ${opts.wpm} wpm · 🎯 ${accuracyPercent}%${
            opts.patternScore !== undefined ? ` · 🧩 ${opts.patternScore}` : ""
        }`,
        `🔥 ${opts.streak} day streak`,
        `CodeSprint`,
    ];
    return lines.join("\n");
}
