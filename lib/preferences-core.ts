export type ThemePreset =
    | "midnight"
    | "vaporwave"
    | "solarized"
    | "dracula"
    | "monokai"
    | "gruvbox"
    | "nord"
    | "oneDark";

export type ThemeTokens = {
    bg: string;
    bgMuted: string;
    bgGradient: string;
    text: string;
    textSubtle: string;
    accent: string;
    caret: string;
    panel: string;
    panelGlass: string;
    panelSoft: string;
    btn: string;
    btnActive: string;
    border: string;
    borderStrong: string;
    shadow: string;
    surface: string;
    surfaceHover: string;
    surfaceActive: string;
    headerBg: string;
    headerBorder: string;
    headerText: string;
    headerTextSubtle: string;
    overlay: string;
    focusRing: string;
    terminalBg: string;
};

export type SurfaceStyle = "panel" | "immersive";
export type InterfaceMode = "ide" | "terminal";

export type PreferencesState = {
    theme: ThemePreset;
    fontSize: number;
    caretWidth: number;
    countdownEnabled: boolean;
    surfaceStyle: SurfaceStyle;
    showLiveStatsDuringRun: boolean;
    interfaceMode: InterfaceMode;
    requireTabForIndent: boolean;
    syntaxHighlightingEnabled: boolean;
};

export const STORAGE_KEY = "codesprint-preferences";

function hexToRgb(hex: string): [number, number, number] {
    const sanitized = hex.replace("#", "");
    if (sanitized.length === 3) {
        const r = parseInt(sanitized[0] + sanitized[0], 16);
        const g = parseInt(sanitized[1] + sanitized[1], 16);
        const b = parseInt(sanitized[2] + sanitized[2], 16);
        return [r, g, b];
    }
    if (sanitized.length !== 6) {
        return [0, 0, 0];
    }
    const numeric = parseInt(sanitized, 16);
    const r = (numeric >> 16) & 255;
    const g = (numeric >> 8) & 255;
    const b = numeric & 255;
    return [r, g, b];
}

function clamp01(value: number): number {
    if (Number.isNaN(value)) return 0;
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
}

function rgbToHex(r: number, g: number, b: number): string {
    const toHex = (channel: number) => channel.toString(16).padStart(2, "0");
    return `#${toHex(Math.round(r))}${toHex(Math.round(g))}${toHex(Math.round(b))}`;
}

function mix(colorA: string, colorB: string, weight: number): string {
    const w = clamp01(weight);
    const [r1, g1, b1] = hexToRgb(colorA);
    const [r2, g2, b2] = hexToRgb(colorB);
    const r = r1 * (1 - w) + r2 * w;
    const g = g1 * (1 - w) + g2 * w;
    const b = b1 * (1 - w) + b2 * w;
    return rgbToHex(r, g, b);
}

function lighten(hex: string, amount: number): string {
    return mix(hex, "#ffffff", clamp01(amount));
}

function darken(hex: string, amount: number): string {
    return mix(hex, "#000000", clamp01(amount));
}

function withAlpha(hex: string, alpha: number): string {
    const [r, g, b] = hexToRgb(hex);
    const clampedAlpha = Math.min(1, Math.max(0, alpha));
    return `rgba(${r}, ${g}, ${b}, ${clampedAlpha})`;
}

function createMinimalTheme(base: string, accent: string): ThemeTokens {
    const gradientTop = lighten(base, 0.08);
    const accentAlpha = (alpha: number) => withAlpha(accent, alpha);
    const baseAlpha = (alpha: number) => withAlpha(base, alpha);
    const surfaceBlend = mix(lighten(base, 0.05), accent, 0.22);
    const surfaceStrongBlend = mix(lighten(base, 0.12), accent, 0.32);
    const borderBlend = mix(base, accent, 0.24);
    const headerBase = darken(base, 0.26);
    const overlayBlend = mix(lighten(base, 0.1), accent, 0.18);
    const terminalBase = darken(base, 0.4);
    return {
        bg: base,
        bgMuted: gradientTop,
        bgGradient: `linear-gradient(180deg, ${base} 0%, ${base} 100%)`,
        text: accent,
        textSubtle: accentAlpha(0.68),
        accent,
        caret: accent,
        panel: withAlpha(surfaceBlend, 0.12),
        panelGlass: withAlpha(surfaceBlend, 0.18),
        panelSoft: withAlpha(surfaceBlend, 0.24),
        btn: withAlpha(surfaceBlend, 0.12),
        btnActive: withAlpha(surfaceStrongBlend, 0.24),
        border: withAlpha(borderBlend, 0.32),
        borderStrong: withAlpha(borderBlend, 0.5),
        shadow: `0 24px 48px ${baseAlpha(0.55)}`,
        surface: withAlpha(surfaceBlend, 0.14),
        surfaceHover: withAlpha(surfaceStrongBlend, 0.2),
        surfaceActive: withAlpha(surfaceStrongBlend, 0.3),
        headerBg: withAlpha(headerBase, 0.84),
        headerBorder: withAlpha(borderBlend, 0.32),
        headerText: accent,
        headerTextSubtle: accentAlpha(0.7),
        overlay: withAlpha(overlayBlend, 0.18),
        focusRing: accentAlpha(0.9),
        terminalBg: terminalBase,
    };
}

export const THEME_PRESETS: Record<ThemePreset, ThemeTokens> = {
    midnight: createMinimalTheme("#05060a", "#f5f7fb"),
    vaporwave: createMinimalTheme("#120022", "#fbe7ff"),
    solarized: createMinimalTheme("#002b36", "#fdf6e3"),
    dracula: createMinimalTheme("#282a36", "#f8f8f2"),
    monokai: createMinimalTheme("#272822", "#f8f8f2"),
    gruvbox: createMinimalTheme("#282828", "#fbf1c7"),
    nord: createMinimalTheme("#2e3440", "#e5e9f0"),
    oneDark: createMinimalTheme("#1e222a", "#e6edf3"),
};

export const DEFAULT_PREFERENCES: PreferencesState = {
    theme: "gruvbox",
    fontSize: 24,
    caretWidth: 3,
    countdownEnabled: true,
    surfaceStyle: "immersive",
    showLiveStatsDuringRun: true,
    interfaceMode: "ide",
    requireTabForIndent: true,
    syntaxHighlightingEnabled: true,
};

export function computeCaretHeight(fontSize: number): number {
    return Math.round(fontSize * 1.55);
}

export function sanitizePreferences(value: unknown): PreferencesState {
    if (!value || typeof value !== "object") return DEFAULT_PREFERENCES;
    const source = value as Partial<PreferencesState>;
    return {
        theme:
            source.theme && typeof source.theme === "string" && source.theme in THEME_PRESETS
                ? (source.theme as ThemePreset)
                : DEFAULT_PREFERENCES.theme,
        fontSize:
            typeof source.fontSize === "number" && source.fontSize >= 16 && source.fontSize <= 36
                ? source.fontSize
                : DEFAULT_PREFERENCES.fontSize,
        caretWidth:
            typeof source.caretWidth === "number" && source.caretWidth >= 2 && source.caretWidth <= 6
                ? source.caretWidth
                : DEFAULT_PREFERENCES.caretWidth,
        countdownEnabled:
            typeof source.countdownEnabled === "boolean"
                ? source.countdownEnabled
                : DEFAULT_PREFERENCES.countdownEnabled,
        surfaceStyle:
            source.surfaceStyle === "panel" || source.surfaceStyle === "immersive"
                ? source.surfaceStyle
                : DEFAULT_PREFERENCES.surfaceStyle,
        showLiveStatsDuringRun:
            typeof source.showLiveStatsDuringRun === "boolean"
                ? source.showLiveStatsDuringRun
                : DEFAULT_PREFERENCES.showLiveStatsDuringRun,
        interfaceMode: source.interfaceMode === "terminal" ? "terminal" : DEFAULT_PREFERENCES.interfaceMode,
        requireTabForIndent:
            typeof source.requireTabForIndent === "boolean"
                ? source.requireTabForIndent
                : DEFAULT_PREFERENCES.requireTabForIndent,
        syntaxHighlightingEnabled:
            typeof source.syntaxHighlightingEnabled === "boolean"
                ? source.syntaxHighlightingEnabled
                : DEFAULT_PREFERENCES.syntaxHighlightingEnabled,
    };
}

