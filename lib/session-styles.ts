import type { ButtonProps } from "@chakra-ui/react";

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
 * Monospace font stack used in terminal mode
 */
export const MONO_FONT_STACK = '"IBM Plex Mono", "JetBrains Mono", "Fira Code", "SFMono-Regular", Menlo, Consolas, Monaco, monospace';

/**
 * Generate pill button styles based on active state and terminal mode
 */
export function getPillButtonStyles(active: boolean, isTerminalMode: boolean): Partial<ButtonProps> {
    const { surface, surfaceHover, surfaceActive, border, borderStrong, textSubtle, accent } = SESSION_CSS_VARS;

    if (isTerminalMode) {
        return {
            size: "sm",
            borderRadius: "8px",
            px: 3,
            py: 2,
            bg: active ? surfaceActive : surface,
            color: active ? accent : textSubtle,
            border: "1px solid",
            borderColor: active ? borderStrong : border,
            fontFamily: MONO_FONT_STACK,
            letterSpacing: "0.08em",
            transition: "all 0.18s ease",
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
        transition: "color 0.15s ease, border-color 0.15s ease",
        _hover: { bg: "transparent", color: accent },
        _active: { bg: "transparent" },
    };
}

/**
 * Generate start button styles based on terminal mode
 */
export function getStartButtonStyles(isTerminalMode: boolean): Partial<ButtonProps> {
    const { surface, surfaceHover, surfaceActive, borderStrong, textSubtle, accent } = SESSION_CSS_VARS;

    if (isTerminalMode) {
        return {
            size: "sm",
            borderRadius: "8px",
            px: 4,
            py: 2,
            fontFamily: MONO_FONT_STACK,
            bg: surface,
            color: accent,
            border: "1px solid",
            borderColor: borderStrong,
            letterSpacing: "0.08em",
            _hover: { bg: surfaceHover },
            _active: { bg: surfaceActive },
        };
    }

    return {
        size: "sm",
        borderRadius: "0",
        px: 3,
        py: 1.5,
        bg: "transparent",
        color: textSubtle,
        fontWeight: 400,
        _hover: { bg: "transparent", color: accent },
        _active: { bg: "transparent" },
    };
}

/**
 * Generate next problem button styles based on terminal mode
 */
export function getNextProblemButtonStyles(isTerminalMode: boolean): Partial<ButtonProps> {
    const { surface, surfaceHover, surfaceActive, borderStrong, accent } = SESSION_CSS_VARS;

    if (isTerminalMode) {
        return {
            size: "sm",
            borderRadius: "8px",
            px: 3,
            py: 2,
            fontFamily: MONO_FONT_STACK,
            bg: surface,
            color: accent,
            border: "1px solid",
            borderColor: borderStrong,
            letterSpacing: "0.08em",
            _hover: { bg: surfaceHover },
            _active: { bg: surfaceActive },
        };
    }

    return {
        size: "sm",
        borderRadius: "full",
        px: 4,
        py: 2,
        bg: accent,
        color: "#141414",
        fontWeight: 600,
        _hover: { bg: "#ffd65a" },
        _active: { bg: "#fcbf2c" },
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
