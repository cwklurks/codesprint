/**
 * Pure param validation for the Daily share loop, shared by the landing page
 * (app/daily/[day]/page.tsx) and the OG image route (app/api/og/route.tsx) so
 * both clamp identically. No framework or zod imports — kept pure and unit-tested.
 */

/** Short codes used in share URLs / OG cards. */
const LANG_CODES = {
    javascript: "js",
    python: "py",
    java: "java",
    cpp: "cpp",
} as const;

/** The set of language codes accepted as the `l` share param. */
export const LANG_CODE_VALUES = ["js", "py", "java", "cpp"] as const;
export type LangCode = (typeof LANG_CODE_VALUES)[number];

/** Maximum valid daily number (matches the landing-page ceiling). */
export const MAX_DAY = 50000;

/**
 * Maps a full language name to its short share code.
 * Known languages map to fixed codes; anything else falls back to the
 * lowercased first four characters.
 */
export function langCode(language: string): string {
    const lower = language.toLowerCase();
    if (lower in LANG_CODES) {
        return LANG_CODES[lower as keyof typeof LANG_CODES];
    }
    return lower.slice(0, 4);
}

/** True when `value` is a string of digits with no decimal/sign decoration. */
function isIntegerString(value: string): boolean {
    return /^\d+$/.test(value);
}

/**
 * Parses the daily-number path segment.
 * Returns the integer when it is a positive whole number within [1, MAX_DAY],
 * else null (the landing page treats null as notFound()).
 */
export function parseDay(value: string | undefined): number | null {
    if (value === undefined || !isIntegerString(value)) {
        return null;
    }
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > MAX_DAY) {
        return null;
    }
    return n;
}

/**
 * Parses an integer search param within [min, max] inclusive.
 * Returns undefined for missing, non-string, non-integer, or out-of-range input
 * so invalid values are silently dropped rather than erroring.
 */
function parseClampedInt(
    value: string | undefined,
    min: number,
    max: number,
): number | undefined {
    if (typeof value !== "string" || !isIntegerString(value)) {
        return undefined;
    }
    const n = Number(value);
    if (!Number.isInteger(n) || n < min || n > max) {
        return undefined;
    }
    return n;
}

function parseLang(value: string | undefined): LangCode | undefined {
    if (typeof value !== "string") {
        return undefined;
    }
    return (LANG_CODE_VALUES as readonly string[]).includes(value)
        ? (value as LangCode)
        : undefined;
}

/** Validated, spoiler-free share params; any invalid field is simply absent. */
export type ShareParams = {
    w?: number;
    a?: number;
    s?: number;
    l?: LangCode;
};

type RawParams = {
    w?: string;
    a?: string;
    s?: string;
    l?: string;
};

/**
 * Validates the share search params (w/a/s/l) with the spec rules:
 *   w: integer 0..400, a: integer 0..100, s: integer 0..10000,
 *   l: one of js|py|java|cpp. Invalid values are dropped, not errors.
 * Pure: never mutates `raw`.
 */
export function parseShareParams(raw: RawParams): ShareParams {
    const result: ShareParams = {};
    const w = parseClampedInt(raw.w, 0, 400);
    const a = parseClampedInt(raw.a, 0, 100);
    const s = parseClampedInt(raw.s, 0, 10000);
    const l = parseLang(raw.l);
    if (w !== undefined) result.w = w;
    if (a !== undefined) result.a = a;
    if (s !== undefined) result.s = s;
    if (l !== undefined) result.l = l;
    return result;
}

/** Total cells in the share/OG progress bar. */
export const BAR_CELLS = 15;

/**
 * Number of filled cells in the 15-cell WPM bar:
 *   Math.round(Math.min(wpm, 100) / 100 * 15), clamped to 0..15.
 * Shared so the text signature and OG card draw the identical bar.
 */
export function barFilledCells(wpm: number): number {
    const raw = Math.round((Math.min(wpm, 100) / 100) * BAR_CELLS);
    return Math.max(0, Math.min(BAR_CELLS, raw));
}
