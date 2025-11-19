"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
    DEFAULT_PREFERENCES,
    InterfaceMode,
    PreferencesState,
    SurfaceStyle,
    ThemePreset,
    THEME_PRESETS,
    STORAGE_KEY,
    computeCaretHeight,
    sanitizePreferences,
} from "@/lib/preferences-core";

type PreferencesContextValue = {
    preferences: PreferencesState;
    setTheme: (theme: ThemePreset) => void;
    setFontSize: (size: number) => void;
    setCaretWidth: (width: number) => void;
    setCountdownEnabled: (enabled: boolean) => void;
    setSurfaceStyle: (style: SurfaceStyle) => void;
    setShowLiveStatsDuringRun: (show: boolean) => void;
    setInterfaceMode: (mode: InterfaceMode) => void;
    setRequireTabForIndent: (require: boolean) => void;
    setSyntaxHighlightingEnabled: (enabled: boolean) => void;
};

const LIVE_STATS_MIGRATION_KEY = "codesprint-live-stats-default-v1";

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined);

function applyTheme(preferences: PreferencesState) {
    if (typeof document === "undefined") return;
    const tokens = THEME_PRESETS[preferences.theme];
    if (!tokens) return;
    const root = document.documentElement;
    const backgroundColor = preferences.interfaceMode === "terminal" ? tokens.terminalBg : tokens.bg;
    const backgroundGradient =
        preferences.interfaceMode === "terminal"
            ? `linear-gradient(180deg, ${tokens.terminalBg} 0%, ${tokens.terminalBg} 100%)`
            : tokens.bgGradient;
    root.style.setProperty("--bg-base", tokens.bg);
    root.style.setProperty("--bg", backgroundColor);
    root.style.setProperty("--bg-muted", tokens.bgMuted);
    root.style.setProperty("--bg-gradient", backgroundGradient);
    root.style.setProperty("--text", tokens.text);
    root.style.setProperty("--text-subtle", tokens.textSubtle);
    root.style.setProperty("--accent", tokens.accent);
    root.style.setProperty("--caret", tokens.caret);
    root.style.setProperty("--error", tokens.error);
    root.style.setProperty("--error-extra", tokens.errorExtra);
    root.style.setProperty("--panel", tokens.panel);
    root.style.setProperty("--panel-glass", tokens.panelGlass);
    root.style.setProperty("--panel-soft", tokens.panelSoft);
    root.style.setProperty("--btn", tokens.btn);
    root.style.setProperty("--btn-active", tokens.btnActive);
    root.style.setProperty("--border", tokens.border);
    root.style.setProperty("--border-strong", tokens.borderStrong);
    root.style.setProperty("--shadow", tokens.shadow);
    root.style.setProperty("--surface", tokens.surface);
    root.style.setProperty("--surface-hover", tokens.surfaceHover);
    root.style.setProperty("--surface-active", tokens.surfaceActive);
    root.style.setProperty("--header-bg", tokens.headerBg);
    root.style.setProperty("--header-border", tokens.headerBorder);
    root.style.setProperty("--header-text", tokens.headerText);
    root.style.setProperty("--header-text-subtle", tokens.headerTextSubtle);
    root.style.setProperty("--overlay", tokens.overlay);
    root.style.setProperty("--focus-ring", tokens.focusRing);
    root.style.setProperty("--terminal-bg", tokens.terminalBg);
    root.style.setProperty("--caret-width", `${preferences.caretWidth}px`);
    root.style.setProperty("--caret-height", `${computeCaretHeight(preferences.fontSize)}px`);
    root.style.setProperty("--editor-font-size", `${preferences.fontSize}px`);
}

export function PreferencesProvider({
    children,
}: {
    children: ReactNode;
}) {
    const [preferences, setPreferences] = useState<PreferencesState>(
        DEFAULT_PREFERENCES
    );
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            const stored = window.localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored) as unknown;
                setPreferences(sanitizePreferences(parsed));
            }
        } catch (err) {
            console.warn("Failed to load preferences", err);
        } finally {
            setHydrated(true);
        }
    }, []);

    useEffect(() => {
        if (!hydrated || typeof window === "undefined") return;
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    }, [preferences, hydrated]);

    useEffect(() => {
        if (!hydrated || typeof window === "undefined") return;
        try {
            const storage = window.localStorage;
            if (storage.getItem(LIVE_STATS_MIGRATION_KEY)) return;
            setPreferences((prev) => {
                storage.setItem(LIVE_STATS_MIGRATION_KEY, "1");
                if (prev.showLiveStatsDuringRun) {
                    return prev;
                }
                return { ...prev, showLiveStatsDuringRun: true };
            });
        } catch (err) {
            console.warn("Failed to migrate live stats preference", err);
        }
    }, [hydrated, setPreferences]);

    useEffect(() => {
        applyTheme(preferences);
    }, [preferences]);

    const setTheme = useCallback((theme: ThemePreset) => {
        setPreferences((prev) => ({ ...prev, theme }));
    }, []);

    const setFontSize = useCallback((size: number) => {
        const clamped = Math.min(36, Math.max(16, Math.round(size)));
        setPreferences((prev) => ({ ...prev, fontSize: clamped }));
    }, []);

    const setCaretWidth = useCallback((width: number) => {
        const clamped = Math.min(6, Math.max(2, Number(width)));
        setPreferences((prev) => ({ ...prev, caretWidth: clamped }));
    }, []);

    const setCountdownEnabled = useCallback((enabled: boolean) => {
        setPreferences((prev) => ({ ...prev, countdownEnabled: enabled }));
    }, []);

    const setSurfaceStyle = useCallback((style: SurfaceStyle) => {
        setPreferences((prev) => ({ ...prev, surfaceStyle: style }));
    }, []);

    const setShowLiveStatsDuringRun = useCallback((show: boolean) => {
        setPreferences((prev) => ({ ...prev, showLiveStatsDuringRun: show }));
    }, []);

    const setInterfaceMode = useCallback((mode: InterfaceMode) => {
        setPreferences((prev) => ({ ...prev, interfaceMode: mode }));
    }, []);

    const setRequireTabForIndent = useCallback((require: boolean) => {
        setPreferences((prev) => ({ ...prev, requireTabForIndent: require }));
    }, []);

    const setSyntaxHighlightingEnabled = useCallback((enabled: boolean) => {
        setPreferences((prev) => ({ ...prev, syntaxHighlightingEnabled: enabled }));
    }, []);

    useEffect(() => {
        if (typeof document === "undefined") return;
        document.documentElement.setAttribute(
            "data-interface",
            preferences.interfaceMode
        );
    }, [preferences.interfaceMode]);

    const value = useMemo<PreferencesContextValue>(
        () => ({
            preferences,
            setTheme,
            setFontSize,
            setCaretWidth,
            setCountdownEnabled,
            setSurfaceStyle,
            setShowLiveStatsDuringRun,
            setInterfaceMode,
            setRequireTabForIndent,
            setSyntaxHighlightingEnabled,
        }),
        [
            preferences,
            setTheme,
            setFontSize,
            setCaretWidth,
            setCountdownEnabled,
            setSurfaceStyle,
            setShowLiveStatsDuringRun,
            setInterfaceMode,
            setRequireTabForIndent,
            setSyntaxHighlightingEnabled,
        ]
    );

    return (
        <PreferencesContext.Provider value={value}>
            {children}
        </PreferencesContext.Provider>
    );
}

export function usePreferences() {
    const context = useContext(PreferencesContext);
    if (!context)
        throw new Error("usePreferences must be used within PreferencesProvider");
    return context;
}

export const THEME_OPTIONS: Array<{ value: ThemePreset; label: string }> = [
    { value: "midnight", label: "Midnight" },
    { value: "vaporwave", label: "Vaporwave" },
    { value: "solarized", label: "Solarized" },
    { value: "dracula", label: "Dracula" },
    { value: "monokai", label: "Monokai" },
    { value: "gruvbox", label: "Gruvbox" },
    { value: "nord", label: "Nord" },
    { value: "oneDark", label: "One Dark" },
    { value: "8008", label: "8008" },
    { value: "arch", label: "Arch" },
    { value: "bento", label: "Bento" },
    { value: "bliss", label: "Bliss" },
    { value: "botanical", label: "Botanical" },
    { value: "carbon", label: "Carbon" },
    { value: "serika", label: "Serika" },
    { value: "miamiNights", label: "Miami Nights" },
    { value: "terra", label: "Terra" },
];

export { DEFAULT_PREFERENCES, THEME_PRESETS } from "@/lib/preferences-core";
export type { ThemePreset, SurfaceStyle, InterfaceMode, PreferencesState } from "@/lib/preferences-core";
