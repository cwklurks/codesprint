import { describe, it, expect } from "vitest";
import {
    DEFAULT_PREFERENCES,
    THEME_PRESETS,
    computeCaretHeight,
    sanitizePreferences,
    type ThemePreset,
} from "../preferences-core";

describe("DEFAULT_PREFERENCES", () => {
    it("has expected default values", () => {
        expect(DEFAULT_PREFERENCES.theme).toBe("gruvbox");
        expect(DEFAULT_PREFERENCES.fontSize).toBe(24);
        expect(DEFAULT_PREFERENCES.caretWidth).toBe(3);
        expect(DEFAULT_PREFERENCES.countdownEnabled).toBe(false);
        expect(DEFAULT_PREFERENCES.surfaceStyle).toBe("immersive");
        expect(DEFAULT_PREFERENCES.showLiveStatsDuringRun).toBe(true);
        expect(DEFAULT_PREFERENCES.interfaceMode).toBe("ide");
        expect(DEFAULT_PREFERENCES.requireTabForIndent).toBe(false);
        expect(DEFAULT_PREFERENCES.syntaxHighlighting).toBe("full");
        expect(DEFAULT_PREFERENCES.vimMode).toBe(false);
        expect(DEFAULT_PREFERENCES.debugGapBuffer).toBe(false);
        expect(DEFAULT_PREFERENCES.spacedRepetitionEnabled).toBe(false);
        expect(DEFAULT_PREFERENCES.adaptiveDifficultyEnabled).toBe(false);
    });
});

describe("THEME_PRESETS", () => {
    const themeNames: ThemePreset[] = [
        "midnight", "vaporwave", "solarized", "dracula", "monokai",
        "gruvbox", "nord", "oneDark", "8008", "arch", "bento",
        "bliss", "botanical", "carbon", "serika", "miamiNights", "terra",
    ];

    it("has all expected themes", () => {
        for (const name of themeNames) {
            expect(THEME_PRESETS[name]).toBeDefined();
        }
    });

    it("each theme has all required token keys", () => {
        const requiredKeys = [
            "bg", "bgMuted", "bgGradient", "text", "textSubtle",
            "accent", "caret", "error", "panel",
            "elev1", "elev2", "elev3",
        ];
        for (const name of themeNames) {
            const theme = THEME_PRESETS[name];
            for (const key of requiredKeys) {
                expect(theme).toHaveProperty(key);
            }
        }
    });
});

describe("computeCaretHeight", () => {
    it("computes height as fontSize * 1.55 rounded", () => {
        expect(computeCaretHeight(24)).toBe(37);
        expect(computeCaretHeight(16)).toBe(25);
        expect(computeCaretHeight(36)).toBe(56);
    });
});

describe("sanitizePreferences", () => {
    it("returns defaults for null/undefined", () => {
        expect(sanitizePreferences(null)).toEqual(DEFAULT_PREFERENCES);
        expect(sanitizePreferences(undefined)).toEqual(DEFAULT_PREFERENCES);
    });

    it("returns defaults for non-object", () => {
        expect(sanitizePreferences("string")).toEqual(DEFAULT_PREFERENCES);
        expect(sanitizePreferences(42)).toEqual(DEFAULT_PREFERENCES);
    });

    it("preserves valid preferences", () => {
        const input = {
            theme: "dracula",
            fontSize: 20,
            caretWidth: 4,
            countdownEnabled: true,
            surfaceStyle: "panel",
            showLiveStatsDuringRun: false,
            interfaceMode: "terminal",
            requireTabForIndent: true,
            syntaxHighlighting: "none",
            vimMode: true,
            debugGapBuffer: true,
            spacedRepetitionEnabled: true,
            adaptiveDifficultyEnabled: true,
        };
        const result = sanitizePreferences(input);
        expect(result.theme).toBe("dracula");
        expect(result.fontSize).toBe(20);
        expect(result.caretWidth).toBe(4);
        expect(result.countdownEnabled).toBe(true);
        expect(result.surfaceStyle).toBe("panel");
        expect(result.showLiveStatsDuringRun).toBe(false);
        expect(result.interfaceMode).toBe("terminal");
        expect(result.requireTabForIndent).toBe(true);
        expect(result.syntaxHighlighting).toBe("none");
        expect(result.vimMode).toBe(true);
        expect(result.debugGapBuffer).toBe(true);
        expect(result.spacedRepetitionEnabled).toBe(true);
        expect(result.adaptiveDifficultyEnabled).toBe(true);
    });

    it("clamps fontSize to valid range (16-36)", () => {
        expect(sanitizePreferences({ fontSize: 10 }).fontSize).toBe(DEFAULT_PREFERENCES.fontSize);
        expect(sanitizePreferences({ fontSize: 50 }).fontSize).toBe(DEFAULT_PREFERENCES.fontSize);
        expect(sanitizePreferences({ fontSize: 16 }).fontSize).toBe(16);
        expect(sanitizePreferences({ fontSize: 36 }).fontSize).toBe(36);
    });

    it("clamps caretWidth to valid range (2-6)", () => {
        expect(sanitizePreferences({ caretWidth: 1 }).caretWidth).toBe(DEFAULT_PREFERENCES.caretWidth);
        expect(sanitizePreferences({ caretWidth: 10 }).caretWidth).toBe(DEFAULT_PREFERENCES.caretWidth);
        expect(sanitizePreferences({ caretWidth: 2 }).caretWidth).toBe(2);
        expect(sanitizePreferences({ caretWidth: 6 }).caretWidth).toBe(6);
    });

    it("rejects invalid theme names", () => {
        expect(sanitizePreferences({ theme: "nonexistent" }).theme).toBe(DEFAULT_PREFERENCES.theme);
    });

    it("sanitizes spacedRepetitionEnabled", () => {
        expect(sanitizePreferences({ spacedRepetitionEnabled: true }).spacedRepetitionEnabled).toBe(true);
        expect(sanitizePreferences({ spacedRepetitionEnabled: false }).spacedRepetitionEnabled).toBe(false);
        expect(sanitizePreferences({ spacedRepetitionEnabled: "yes" }).spacedRepetitionEnabled).toBe(false);
        expect(sanitizePreferences({}).spacedRepetitionEnabled).toBe(false);
    });

    it("sanitizes adaptiveDifficultyEnabled", () => {
        expect(sanitizePreferences({ adaptiveDifficultyEnabled: true }).adaptiveDifficultyEnabled).toBe(true);
        expect(sanitizePreferences({ adaptiveDifficultyEnabled: false }).adaptiveDifficultyEnabled).toBe(false);
        expect(sanitizePreferences({ adaptiveDifficultyEnabled: 42 }).adaptiveDifficultyEnabled).toBe(false);
        expect(sanitizePreferences({}).adaptiveDifficultyEnabled).toBe(false);
    });

    it("migrates legacy syntaxHighlightingEnabled boolean", () => {
        expect(sanitizePreferences({ syntaxHighlightingEnabled: true }).syntaxHighlighting).toBe("full");
        expect(sanitizePreferences({ syntaxHighlightingEnabled: false }).syntaxHighlighting).toBe("none");
    });
});
