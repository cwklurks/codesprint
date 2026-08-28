import type { ButtonProps } from "@chakra-ui/react";
import { compositeOver, contrastRatio, relativeLuminance } from "@/lib/contrast";
import { MOTION_DURATION } from "@/lib/motion";
import { THEME_PRESETS, type ThemePreset } from "@/lib/preferences-core";

/**
 * CSS variable references for session styling
 */
export const SESSION_CSS_VARS = {
    surface: "var(--surface)",
    surfaceHover: "var(--surface-hover)",
    surfaceActive: "var(--surface-active)",
    panelGlass: "var(--panel-glass)",
    border: "var(--border)",
    borderStrong: "var(--border-strong)",
    text: "var(--text)",
    textSubtle: "var(--text-subtle)",
    accent: "var(--accent)",
    overlay: "var(--overlay)",
    bg: "var(--bg)",
} as const;

/**
 * Monospace font stack used in terminal mode. Points at the one canonical stack
 * declared in app/globals.css (fed by next/font in app/layout.tsx).
 */
export const MONO_FONT_STACK = "var(--font-mono), ui-monospace, Menlo, Consolas, monospace";

/** Shared hover/press timing so every session control settles at the same speed. */
const CONTROL_TRANSITION = [
    `background-color ${MOTION_DURATION.quick}s ease`,
    `border-color ${MOTION_DURATION.quick}s ease`,
    `color ${MOTION_DURATION.quick}s ease`,
    `box-shadow ${MOTION_DURATION.quick}s ease`,
].join(", ");

/** How far hover/active fills travel from the resting accent. */
const ACCENT_HOVER_SHIFT = 0.14;
const ACCENT_ACTIVE_SHIFT = 0.26;
/** WCAG AA floor for the label sitting on an accent fill. */
const MIN_LABEL_CONTRAST = 4.5;
/** Granularity of the search for the least-deviating readable label. */
const LABEL_STEP = 0.02;

const EXTREMES = ["#ffffff", "#000000"] as const;

export type AccentButtonPalette = {
    /** Resting fill. */
    fill: string;
    /** Hover fill — one step further from the label. */
    fillHover: string;
    /** Pressed fill — the same step, taken further. */
    fillActive: string;
    /** Label color that clears WCAG AA on all three fills. */
    label: string;
};

function minContrast(color: string, fills: readonly string[]): number {
    return fills.reduce((lowest, fill) => Math.min(lowest, contrastRatio(color, fill)), Number.POSITIVE_INFINITY);
}

/**
 * The least-deviating readable label for copy sitting on `fills`.
 *
 * Starts from the theme's own background and text colors and keeps them
 * untouched whenever one of them already clears AA. Only when the palette
 * cannot reach the floor on its own (serika's dark gold and 8008's pink are both
 * short from either side) does it push the better candidate toward the nearest
 * extreme, stopping the moment the floor is met.
 */
function deriveLabel(bg: string, text: string, fills: readonly string[]): string {
    let best = bg;
    let bestScore = -1;
    for (let alpha = 0; alpha <= 1.0001; alpha += LABEL_STEP) {
        for (const base of [bg, text]) {
            for (const extreme of EXTREMES) {
                const candidate = alpha === 0 ? base : compositeOver(extreme, base, alpha);
                const score = minContrast(candidate, fills);
                if (score >= MIN_LABEL_CONTRAST) return candidate;
                if (score > bestScore) {
                    bestScore = score;
                    best = candidate;
                }
            }
        }
    }
    return best;
}

const accentPaletteCache = new Map<ThemePreset, AccentButtonPalette>();

/**
 * Resting/hover/press fills for the primary call to action plus a label that
 * stays legible on all three. Derived from the active theme's own tokens — the
 * accent is per-theme and several of them (serika's dark gold most of all)
 * cannot carry a fixed label color.
 *
 * Hover and press step the fill away from the label rather than toward the
 * background: on a palette with only ~0.5 stops of headroom (serika again) the
 * background direction eats the label's contrast, while this direction can only
 * add to it. The visible weight of the interaction comes from the scale and
 * elevation change (see `getStartButtonMotion`); the fill shift is the tint.
 */
export function getAccentButtonPalette(theme: ThemePreset): AccentButtonPalette {
    const cached = accentPaletteCache.get(theme);
    if (cached) return cached;

    const tokens = THEME_PRESETS[theme] ?? THEME_PRESETS.gruvbox;
    const fill = tokens.accent;
    const label = deriveLabel(tokens.bg, tokens.text, [fill]);
    const awayFromLabel = relativeLuminance(label) >= relativeLuminance(fill) ? EXTREMES[1] : EXTREMES[0];
    const palette: AccentButtonPalette = {
        fill,
        fillHover: compositeOver(awayFromLabel, fill, ACCENT_HOVER_SHIFT),
        fillActive: compositeOver(awayFromLabel, fill, ACCENT_ACTIVE_SHIFT),
        label,
    };

    accentPaletteCache.set(theme, palette);
    return palette;
}

/**
 * Generate pill button styles based on active state and terminal mode
 */
export function getPillButtonStyles(active: boolean, isTerminalMode: boolean): Partial<ButtonProps> {
    const { surface, surfaceHover, surfaceActive, border, borderStrong, textSubtle, accent } = SESSION_CSS_VARS;

    if (isTerminalMode) {
        return {
            size: "sm",
            borderRadius: "var(--radius-sm)",
            px: 3,
            py: 2,
            bg: active ? surfaceActive : surface,
            color: active ? accent : textSubtle,
            border: "1px solid",
            borderColor: active ? borderStrong : border,
            fontFamily: MONO_FONT_STACK,
            letterSpacing: "0.08em",
            transition: CONTROL_TRANSITION,
            _hover: { bg: surfaceHover, color: accent },
            _active: { bg: surfaceActive },
        };
    }

    return {
        size: "sm",
        borderRadius: "0",
        px: 3,
        py: 1.5,
        bg: "transparent",
        color: active ? accent : textSubtle,
        border: "none",
        borderBottom: active ? `2px solid ${accent}` : "2px solid transparent",
        fontWeight: active ? 500 : 400,
        transition: CONTROL_TRANSITION,
        _hover: { bg: "transparent", color: accent },
        _active: { bg: "transparent" },
    };
}

/**
 * Start is the session's primary action, so in IDE mode it carries the accent
 * fill. Terminal mode keeps its flat bordered look — a filled pill would break
 * the monochrome console read.
 */
export function getStartButtonStyles(isTerminalMode: boolean, theme: ThemePreset): Partial<ButtonProps> {
    const { surface, surfaceHover, surfaceActive, borderStrong, accent } = SESSION_CSS_VARS;

    if (isTerminalMode) {
        return {
            size: "sm",
            borderRadius: "var(--radius-sm)",
            px: 4,
            py: 2,
            fontFamily: MONO_FONT_STACK,
            bg: surface,
            color: accent,
            border: "1px solid",
            borderColor: borderStrong,
            letterSpacing: "0.08em",
            transition: CONTROL_TRANSITION,
            _hover: { bg: surfaceHover },
            _active: { bg: surfaceActive },
        };
    }

    const palette = getAccentButtonPalette(theme);

    return {
        size: "sm",
        borderRadius: "full",
        px: 5,
        py: 2,
        bg: palette.fill,
        color: palette.label,
        fontWeight: 600,
        letterSpacing: "0.01em",
        border: "1px solid transparent",
        boxShadow: "var(--elev-1)",
        transition: CONTROL_TRANSITION,
        _hover: { bg: palette.fillHover, boxShadow: "var(--elev-2)" },
        _active: { bg: palette.fillActive, boxShadow: "var(--elev-1)" },
    };
}

/**
 * Next problem is a secondary move once a snippet is on screen, so it reads as a
 * quiet outline next to the accent-filled Start.
 */
export function getNextProblemButtonStyles(isTerminalMode: boolean): Partial<ButtonProps> {
    const { surface, surfaceHover, surfaceActive, border, borderStrong, text, textSubtle, accent } = SESSION_CSS_VARS;

    if (isTerminalMode) {
        return {
            size: "sm",
            borderRadius: "var(--radius-sm)",
            px: 3,
            py: 2,
            fontFamily: MONO_FONT_STACK,
            bg: surface,
            color: accent,
            border: "1px solid",
            borderColor: borderStrong,
            letterSpacing: "0.08em",
            transition: CONTROL_TRANSITION,
            _hover: { bg: surfaceHover },
            _active: { bg: surfaceActive },
        };
    }

    return {
        size: "sm",
        borderRadius: "full",
        px: 4,
        py: 2,
        bg: "transparent",
        color: textSubtle,
        fontWeight: 500,
        border: "1px solid",
        borderColor: border,
        transition: CONTROL_TRANSITION,
        _hover: { bg: surfaceHover, color: text, borderColor: borderStrong },
        _active: { bg: surfaceActive, color: text },
    };
}

/**
 * Calculate layout gap based on interface mode
 */
export function getLayoutGap(isTerminalMode: boolean, isImmersive: boolean): number {
    if (isTerminalMode) return 4;
    if (isImmersive) return 4;
    return 6;
}
