import { describe, expect, it } from "vitest";
import { compositeOver, contrastRatio } from "../contrast";
import { THEME_PRESETS, type ThemeTokens } from "../preferences-core";

/**
 * Accessibility floor for the theme palettes themselves. Every preset has to be
 * readable before a single component is styled, so this measures the tokens the
 * theme writers put on <html> rather than any rendered output.
 */

/** WCAG AA for body-size copy. */
const TEXT_MIN = 4.5;
/** WCAG AA for large text, icons and other non-text UI (accents, carets, rules). */
const NON_TEXT_MIN = 3.0;

const RGBA_PATTERN = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/;

/**
 * Contrast math only works on opaque colors. Theme tokens may be authored as
 * `rgba(...)`, so flatten those over the background they will be painted on.
 */
function flattenOver(color: string, background: string): string {
    const rgba = RGBA_PATTERN.exec(color);
    if (!rgba) return color;
    const [, r, g, b, alpha] = rgba;
    const hex = `#${[r, g, b].map((channel) => Number(channel).toString(16).padStart(2, "0")).join("")}`;
    return compositeOver(hex, background, alpha === undefined ? 1 : Number(alpha));
}

function ratioAgainstBg(color: string, background: string): number {
    return contrastRatio(flattenOver(color, background), background);
}

const presets = Object.entries(THEME_PRESETS) as ReadonlyArray<[string, ThemeTokens]>;

describe("theme preset contrast", () => {
    it.each(presets)("%s: body text clears WCAG AA against its background", (_name, theme) => {
        expect(ratioAgainstBg(theme.text, theme.bg)).toBeGreaterThanOrEqual(TEXT_MIN);
    });

    it.each(presets)("%s: muted text clears WCAG AA against its background", (_name, theme) => {
        expect(ratioAgainstBg(theme.textSubtle, theme.bg)).toBeGreaterThanOrEqual(TEXT_MIN);
    });

    it.each(presets)("%s: accent clears the WCAG non-text floor against its background", (_name, theme) => {
        expect(ratioAgainstBg(theme.accent, theme.bg)).toBeGreaterThanOrEqual(NON_TEXT_MIN);
    });

    it.each(presets)("%s: body and muted text stay readable on the terminal backdrop", (_name, theme) => {
        // Terminal mode swaps the page background for terminalBg while text stays put.
        expect(ratioAgainstBg(theme.text, theme.terminalBg)).toBeGreaterThanOrEqual(TEXT_MIN);
        expect(ratioAgainstBg(theme.textSubtle, theme.terminalBg)).toBeGreaterThanOrEqual(TEXT_MIN);
    });

    it.each(presets)("%s: status colors clear the non-text floor against the background", (_name, theme) => {
        expect(ratioAgainstBg(theme.error, theme.bg)).toBeGreaterThanOrEqual(NON_TEXT_MIN);
        expect(ratioAgainstBg(theme.success, theme.bg)).toBeGreaterThanOrEqual(NON_TEXT_MIN);
        expect(ratioAgainstBg(theme.warning, theme.bg)).toBeGreaterThanOrEqual(NON_TEXT_MIN);
    });

    it("keeps muted text visibly quieter than body text wherever the palette allows", () => {
        // Muting is the point: textSubtle should not silently collapse onto text.
        const collapsed = presets.filter(([, theme]) => theme.textSubtle === theme.text);
        expect(collapsed).toEqual([]);
    });
});
