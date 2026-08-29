import { describe, it, expect } from "vitest";
import {
    getAccentButtonPalette,
    getNextProblemButtonStyles,
    getPillButtonStyles,
    getResultPrimaryButtonStyles,
    getStartButtonStyles,
} from "../session-styles";
import { THEME_PRESETS, type ThemePreset } from "../preferences-core";
import { contrastRatio } from "../contrast";

const THEMES = Object.keys(THEME_PRESETS) as ThemePreset[];

describe("getPillButtonStyles — active affordance (IDE mode)", () => {
    it("underlines the active pill with the accent color", () => {
        const active = getPillButtonStyles(true, false);
        expect(active.borderBottom).toBe("2px solid var(--accent)");
    });

    it("keeps the inactive pill underline transparent so there is no layout shift", () => {
        const inactive = getPillButtonStyles(false, false);
        expect(inactive.borderBottom).toBe("2px solid transparent");
    });
});

describe("getAccentButtonPalette", () => {
    it.each(THEMES)("keeps the label readable on every fill (%s)", (theme) => {
        const { fill, fillHover, fillActive, label } = getAccentButtonPalette(theme);
        for (const surface of [fill, fillHover, fillActive]) {
            expect(contrastRatio(label, surface)).toBeGreaterThanOrEqual(4.5);
        }
    });

    it.each(THEMES)("moves the fill perceptibly on hover and press (%s)", (theme) => {
        const { fill, fillHover, fillActive } = getAccentButtonPalette(theme);
        expect(fillHover).not.toBe(fill);
        expect(fillActive).not.toBe(fill);
    });

    it("returns a stable palette for repeated lookups", () => {
        expect(getAccentButtonPalette("serika")).toBe(getAccentButtonPalette("serika"));
    });
});

describe("CTA hierarchy (IDE mode)", () => {
    it.each(THEMES)("fills Start with the theme accent and no hex literals leak in (%s)", (theme) => {
        const start = getStartButtonStyles(false, theme);
        expect(start.bg).toBe(THEME_PRESETS[theme].accent);
        expect(start.color).toBe(getAccentButtonPalette(theme).label);
        expect(start.fontWeight).toBe(600);
    });

    it("leaves Next problem as the quiet outline so it cannot outrank Start", () => {
        const next = getNextProblemButtonStyles(false);
        expect(next.bg).toBe("transparent");
        expect(next.color).toBe("var(--text-subtle)");
        expect(next.borderColor).toBe("var(--border)");
    });

    it("keeps terminal mode monochrome for both actions", () => {
        expect(getStartButtonStyles(true, "gruvbox").bg).toBe("var(--surface)");
        expect(getNextProblemButtonStyles(true).bg).toBe("var(--surface)");
    });
});

describe("result screen CTA", () => {
    it.each(THEMES)("fills the result's next-problem action like Start (%s)", (theme) => {
        const result = getResultPrimaryButtonStyles(theme);
        const palette = getAccentButtonPalette(theme);
        expect(result.bg).toBe(palette.fill);
        expect(result.color).toBe(palette.label);
        expect(result.size).toBe("lg");
    });

    it("outranks the quiet next-problem button in the session top bar", () => {
        // Same words, different jobs: on the result screen it is the one thing
        // to do next, in the top bar it is an escape hatch.
        expect(getResultPrimaryButtonStyles("gruvbox").bg).not.toBe(getNextProblemButtonStyles(false).bg);
    });
});
