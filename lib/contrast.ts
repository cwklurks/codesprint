/**
 * Pure WCAG contrast helpers for the typing surface.
 *
 * The read-ahead (not-yet-typed) code is rendered as a muted state by alpha-
 * blending the theme text over the opaque theme background. A flat alpha makes
 * the untyped text invisible on low-contrast themes, so we derive a per-theme
 * alpha that clears the WCAG 3:1 non-text/large floor while staying muted.
 */

function expandHex(hex: string): string {
    const sanitized = hex.replace("#", "");
    if (sanitized.length === 3) {
        return sanitized
            .split("")
            .map((char) => char + char)
            .join("");
    }
    return sanitized.slice(0, 6);
}

function hexToRgb(hex: string): [number, number, number] {
    const sanitized = expandHex(hex);
    if (sanitized.length !== 6) {
        return [0, 0, 0];
    }
    const numeric = parseInt(sanitized, 16);
    if (Number.isNaN(numeric)) {
        return [0, 0, 0];
    }
    return [(numeric >> 16) & 255, (numeric >> 8) & 255, numeric & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
    const channel = (value: number) =>
        Math.round(Math.min(255, Math.max(0, value)))
            .toString(16)
            .padStart(2, "0");
    return `#${channel(r)}${channel(g)}${channel(b)}`;
}

function channelLuminance(channel: number): number {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a hex color, in [0, 1]. */
export function relativeLuminance(hex: string): number {
    const [r, g, b] = hexToRgb(hex);
    return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

/** WCAG contrast ratio between two hex colors, in [1, 21]. Symmetric. */
export function contrastRatio(hexA: string, hexB: string): number {
    const lumA = relativeLuminance(hexA);
    const lumB = relativeLuminance(hexB);
    const lighter = Math.max(lumA, lumB);
    const darker = Math.min(lumA, lumB);
    return (lighter + 0.05) / (darker + 0.05);
}

/** Alpha-blend an opaque foreground over an opaque background, returning a hex color. */
export function compositeOver(fgHex: string, bgHex: string, alpha: number): string {
    const a = Math.min(1, Math.max(0, alpha));
    const [fr, fg, fb] = hexToRgb(fgHex);
    const [br, bg, bb] = hexToRgb(bgHex);
    return rgbToHex(fr * a + br * (1 - a), fg * a + bg * (1 - a), fb * a + bb * (1 - a));
}

const MAX_UNTYPED_ALPHA = 0.7;
const ALPHA_STEP = 0.01;

/**
 * Smallest alpha in (0, MAX_UNTYPED_ALPHA] such that the foreground composited
 * over the background clears `targetRatio` against that same background. If the
 * target is unreachable under the cap, returns the cap (best muted effort).
 */
export function minAlphaForContrast(fgHex: string, bgHex: string, targetRatio: number): number {
    for (let alpha = ALPHA_STEP; alpha < MAX_UNTYPED_ALPHA; alpha += ALPHA_STEP) {
        if (contrastRatio(compositeOver(fgHex, bgHex, alpha), bgHex) >= targetRatio) {
            return alpha;
        }
    }
    return MAX_UNTYPED_ALPHA;
}

/**
 * The most muted opaque form of `fgHex` over `bgHex` that still clears
 * `targetRatio`. Starts at the read-ahead muting alpha and keeps stepping toward
 * the full foreground when that cap alone cannot reach the target (the cap only
 * governs the read-ahead layer, not UI copy). Returns `fgHex` when even full
 * opacity falls short, which means the palette itself has to change.
 */
export function mutedColorForContrast(fgHex: string, bgHex: string, targetRatio: number): string {
    for (let alpha = minAlphaForContrast(fgHex, bgHex, targetRatio); alpha < 1; alpha += ALPHA_STEP) {
        const candidate = compositeOver(fgHex, bgHex, alpha);
        if (contrastRatio(candidate, bgHex) >= targetRatio) {
            return candidate;
        }
    }
    return fgHex;
}
