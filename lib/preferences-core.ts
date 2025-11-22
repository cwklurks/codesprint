export type ThemePreset =
    | "midnight"
    | "vaporwave"
    | "solarized"
    | "dracula"
    | "monokai"
    | "gruvbox"
    | "nord"
    | "oneDark"
    | "8008"
    | "arch"
    | "bento"
    | "bliss"
    | "botanical"
    | "carbon"
    | "serika"
    | "miamiNights"
    | "terra";

export type ThemeTokens = {
    bg: string;
    bgMuted: string;
    bgGradient: string;
    text: string;
    textSubtle: string;
    accent: string;
    caret: string;
    error: string;
    errorExtra: string;
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
    vimMode: boolean;
    debugGapBuffer: boolean;
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

function createMinimalTheme(base: string, accent: string, overrides: Partial<ThemeTokens> = {}): ThemeTokens {
    const gradientTop = lighten(base, 0.08);
    const accentAlpha = (alpha: number) => withAlpha(accent, alpha);
    const baseAlpha = (alpha: number) => withAlpha(base, alpha);
    const surfaceBlend = mix(lighten(base, 0.05), accent, 0.22);
    const surfaceStrongBlend = mix(lighten(base, 0.12), accent, 0.32);
    const borderBlend = mix(base, accent, 0.24);
    const headerBase = base; // Use base color for header to minimize contrast/dirtiness
    const overlayBlend = mix(lighten(base, 0.1), accent, 0.18);
    const terminalBase = darken(base, 0.4);

    const defaults: ThemeTokens = {
        bg: base,
        bgMuted: gradientTop,
        bgGradient: `linear-gradient(180deg, ${base} 0%, ${base} 100%)`,
        text: accent,
        textSubtle: accentAlpha(0.68),
        accent,
        caret: accent,
        error: "#da3333",
        errorExtra: "#791717",
        panel: withAlpha(surfaceBlend, 0.12),
        panelGlass: withAlpha(surfaceBlend, 0.12),
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
        headerText: overrides?.text || accent, // Use text color for header text, allowing overrides
        headerTextSubtle: accentAlpha(0.7),
        overlay: withAlpha(overlayBlend, 0.18),
        focusRing: accentAlpha(0.9),
        terminalBg: terminalBase,
    };

    return { ...defaults, ...overrides };
}

type MonkeytypeColors = {
    bg: string;
    main: string;
    caret: string;
    sub: string;
    subAlt: string;
    text: string;
    error: string;
    errorExtra: string;
    colorfulError: string;
    colorfulErrorExtra: string;
};

function createMonkeytypeTheme(colors: MonkeytypeColors): ThemeTokens {
    const { bg, main, caret, sub, subAlt, text, error, errorExtra } = colors;

    // Derive UI tokens from the palette to maintain the aesthetic
    // We use 'sub' and 'subAlt' for muted elements

    return {
        bg,
        bgMuted: subAlt,
        bgGradient: `linear-gradient(180deg, ${bg} 0%, ${bg} 100%)`,
        text,
        textSubtle: sub,
        accent: main,
        caret,
        error,
        errorExtra,
        // UI Elements derived from sub/subAlt for a cohesive look
        panel: withAlpha(subAlt, 0.4),
        panelGlass: withAlpha(subAlt, 0.3),
        panelSoft: withAlpha(subAlt, 0.8),
        btn: withAlpha(sub, 0.2),
        btnActive: withAlpha(sub, 0.4),
        border: withAlpha(sub, 0.3),
        borderStrong: withAlpha(sub, 0.5),
        shadow: `0 24px 48px ${withAlpha(bg, 0.8)}`,
        surface: withAlpha(subAlt, 0.5),
        surfaceHover: withAlpha(subAlt, 0.7),
        surfaceActive: withAlpha(subAlt, 0.9),
        headerBg: withAlpha(bg, 0.95),
        headerBorder: withAlpha(sub, 0.2),
        headerText: main,
        headerTextSubtle: sub,
        overlay: withAlpha(bg, 0.8),
        focusRing: withAlpha(main, 0.5),
        terminalBg: darken(bg, 0.2),
    };
}

export const THEME_PRESETS: Record<ThemePreset, ThemeTokens> = {
    midnight: createMinimalTheme("#05060a", "#f5f7fb"),
    vaporwave: createMinimalTheme("#120022", "#fbe7ff", {
        text: "#ff71ce",
        accent: "#01cdfe",
        caret: "#01cdfe",
        bgGradient: "linear-gradient(180deg, #120022 0%, #2a003e 100%)",
    }),
    solarized: createMinimalTheme("#002b36", "#2aa198", {
        bgMuted: "#073642",
        text: "#839496",
        textSubtle: "#586e75",
        panel: "rgba(7, 54, 66, 0.6)",
        border: "rgba(88, 110, 117, 0.3)",
    }),
    dracula: createMinimalTheme("#282a36", "#bd93f9", {
        bgMuted: "#44475a",
        text: "#f8f8f2",
        textSubtle: "#6272a4",
        panel: "rgba(68, 71, 90, 0.6)",
        border: "rgba(98, 114, 164, 0.3)",
    }),
    monokai: createMinimalTheme("#272822", "#a6e22e", {
        bgMuted: "#3e3d32",
        text: "#f8f8f2",
        textSubtle: "#75715e",
        panel: "rgba(62, 61, 50, 0.6)",
        border: "rgba(117, 113, 94, 0.3)",
    }),
    gruvbox: createMinimalTheme("#282828", "#d79921", {
        bgMuted: "#3c3836",
        text: "#ebdbb2",
        textSubtle: "#a89984",
        panel: "rgba(60, 56, 54, 0.6)",
        border: "rgba(168, 153, 132, 0.3)",
    }),
    nord: createMinimalTheme("#2e3440", "#88c0d0", {
        bgMuted: "#3b4252",
        text: "#d8dee9",
        textSubtle: "#4c566a",
        panel: "rgba(59, 66, 82, 0.6)",
        border: "rgba(76, 86, 106, 0.3)",
    }),
    oneDark: createMinimalTheme("#282c34", "#61afef", {
        bgMuted: "#21252b",
        text: "#abb2bf",
        textSubtle: "#5c6370",
        panel: "rgba(33, 37, 43, 0.6)",
        border: "rgba(92, 99, 112, 0.3)",
    }),
    "8008": createMonkeytypeTheme({
        bg: "#333a45",
        main: "#f44c7f",
        caret: "#f44c7f",
        sub: "#939eae",
        subAlt: "#2e343d",
        text: "#e9ecf0",
        error: "#da3333",
        errorExtra: "#791717",
        colorfulError: "#c5da33",
        colorfulErrorExtra: "#849224",
    }),
    arch: createMonkeytypeTheme({
        bg: "#0c0d11",
        main: "#7ebab5",
        caret: "#7ebab5",
        sub: "#454864",
        subAlt: "#171a25",
        text: "#f6f5f5",
        error: "#ff4754",
        errorExtra: "#b02a33",
        colorfulError: "#ff4754",
        colorfulErrorExtra: "#b02a33",
    }),
    bento: createMonkeytypeTheme({
        bg: "#2d394d",
        main: "#ff7a90",
        caret: "#ff7a90",
        sub: "#4a768d",
        subAlt: "#263041",
        text: "#fffaf8",
        error: "#ee2a3a",
        errorExtra: "#f04040",
        colorfulError: "#fc2032",
        colorfulErrorExtra: "#f04040",
    }),
    bliss: createMonkeytypeTheme({
        bg: "#262727",
        main: "#f0d3c9",
        caret: "#f0d3c9",
        sub: "#665957",
        subAlt: "#343231",
        text: "#fff",
        error: "#bd4141",
        errorExtra: "#883434",
        colorfulError: "#bd4141",
        colorfulErrorExtra: "#883434",
    }),
    botanical: createMonkeytypeTheme({
        bg: "#7b9c98",
        main: "#eaf1f3",
        caret: "#abc6c4",
        sub: "#495755",
        subAlt: "#72908d",
        text: "#eaf1f3",
        error: "#f6c9b4",
        errorExtra: "#f59a71",
        colorfulError: "#f6c9b4",
        colorfulErrorExtra: "#f59a71",
    }),
    carbon: createMonkeytypeTheme({
        bg: "#313131",
        main: "#f66e0d",
        caret: "#f66e0d",
        sub: "#616161",
        subAlt: "#2b2b2b",
        text: "#f5e6c8",
        error: "#e72d2d",
        errorExtra: "#7e2a33",
        colorfulError: "#e72d2d",
        colorfulErrorExtra: "#7e2a33",
    }),
    serika: createMinimalTheme("#e1e1e3", "#d1a510", {
        bgMuted: "#d1d3d8",
        text: "#323437",
        textSubtle: "#646669",
        panel: "rgba(209, 211, 216, 0.4)",
        border: "rgba(50, 52, 55, 0.15)",
    }),
    miamiNights: createMonkeytypeTheme({
        bg: "#18181a",
        main: "#e4609b",
        caret: "#e4609b",
        sub: "#47bac0",
        subAlt: "#0f0f10",
        text: "#fff",
        error: "#fff591",
        errorExtra: "#b6af68",
        colorfulError: "#fff591",
        colorfulErrorExtra: "#b6af68",
    }),
    terra: createMonkeytypeTheme({
        bg: "#0c100e",
        main: "#89c559",
        caret: "#89c559",
        sub: "#436029",
        subAlt: "#0f1d18",
        text: "#f0edd1",
        error: "#d3ca78",
        errorExtra: "#89844d",
        colorfulError: "#d3ca78",
        colorfulErrorExtra: "#89844d",
    }),
};

export const DEFAULT_PREFERENCES: PreferencesState = {
    theme: "gruvbox",
    fontSize: 24,
    caretWidth: 3,
    countdownEnabled: true,
    surfaceStyle: "immersive",
    showLiveStatsDuringRun: true,
    interfaceMode: "ide",
    requireTabForIndent: false,
    syntaxHighlightingEnabled: true,
    vimMode: false,
    debugGapBuffer: false,
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
        vimMode: typeof source.vimMode === "boolean" ? source.vimMode : DEFAULT_PREFERENCES.vimMode,
        debugGapBuffer:
            typeof source.debugGapBuffer === "boolean" ? source.debugGapBuffer : DEFAULT_PREFERENCES.debugGapBuffer,
    };
}

