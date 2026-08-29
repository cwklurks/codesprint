"use client";

import {
    createContext,
    use,
    useEffect,
    useMemo,
    useSyncExternalStore,
    type ReactNode,
} from "react";
import {
    DEFAULT_PREFERENCES,
    InterfaceMode,
    PreferencesState,
    SurfaceStyle,
    SyntaxHighlightingMode,
    ThemePreset,
    SnippetLength,
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
    setSyntaxHighlighting: (mode: SyntaxHighlightingMode) => void;
    setVimMode: (enabled: boolean) => void;
    setDebugGapBuffer: (enabled: boolean) => void;
    setSpacedRepetitionEnabled: (enabled: boolean) => void;
    setAdaptiveDifficultyEnabled: (enabled: boolean) => void;
    setAIDrillsEnabled: (enabled: boolean) => void;
    setAIProvider: (provider: "claude" | "openai" | "fireworks") => void;
    setAIMaxDrillsPerDay: (limit: number) => void;
    setAIAutoGenerate: (enabled: boolean) => void;
    setAIDrillLengthPreference: (preference: SnippetLength | "auto") => void;
};

const LIVE_STATS_MIGRATION_KEY = "codesprint-live-stats-default-v1";
const COUNTDOWN_MIGRATION_KEY = "codesprint-countdown-default-v1";
const VIM_MODE_MIGRATION_KEY = "codesprint-vim-mode-default-v1";
const PREFERENCES_CHANGE_EVENT = "codesprint-preferences-change";

const SERVER_SNAPSHOT = JSON.stringify(DEFAULT_PREFERENCES);

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined);

function applyTheme(preferences: PreferencesState) {
    if (typeof document === "undefined") return;
    const tokens = THEME_PRESETS[preferences.theme];
    if (!tokens) return;
    const root = document.documentElement;
    const backgroundColor = preferences.interfaceMode === "terminal" ? tokens.terminalBg : tokens.bg;
    const backgroundGradient = preferences.interfaceMode === "terminal" ? tokens.terminalBg : tokens.bgGradient;
    root.style.setProperty("--bg", backgroundColor);
    root.style.setProperty("--bg-muted", tokens.bgMuted);
    root.style.setProperty("--bg-gradient", backgroundGradient);
    root.style.setProperty("--text", tokens.text);
    root.style.setProperty("--text-subtle", tokens.textSubtle);
    root.style.setProperty("--accent", tokens.accent);
    root.style.setProperty("--caret", tokens.caret);
    root.style.setProperty("--error", tokens.error);
    root.style.setProperty("--success", tokens.success);
    root.style.setProperty("--warning", tokens.warning);
    root.style.setProperty("--panel", tokens.panel);
    root.style.setProperty("--panel-glass", tokens.panelGlass);
    root.style.setProperty("--panel-soft", tokens.panelSoft);
    root.style.setProperty("--border", tokens.border);
    root.style.setProperty("--border-strong", tokens.borderStrong);
    root.style.setProperty("--elev-1", tokens.elev1);
    root.style.setProperty("--elev-2", tokens.elev2);
    root.style.setProperty("--elev-3", tokens.elev3);
    root.style.setProperty("--surface", tokens.surface);
    root.style.setProperty("--surface-hover", tokens.surfaceHover);
    root.style.setProperty("--surface-active", tokens.surfaceActive);
    root.style.setProperty("--header-bg", tokens.headerBg);
    root.style.setProperty("--header-border", tokens.headerBorder);
    root.style.setProperty("--header-text", tokens.headerText);
    root.style.setProperty("--overlay", tokens.overlay);
    root.style.setProperty("--focus-ring", tokens.focusRing);
    root.style.setProperty("--terminal-bg", tokens.terminalBg);
    root.style.setProperty("--caret-width", `${preferences.caretWidth}px`);
    root.style.setProperty("--caret-height", `${computeCaretHeight(preferences.fontSize)}px`);
}

function subscribe(callback: () => void) {
    if (typeof window === "undefined") return () => {};
    const handler = () => callback();
    window.addEventListener("storage", handler);
    window.addEventListener(PREFERENCES_CHANGE_EVENT, handler);
    return () => {
        window.removeEventListener("storage", handler);
        window.removeEventListener(PREFERENCES_CHANGE_EVENT, handler);
    };
}

function getSnapshot(): string {
    if (typeof window === "undefined") return SERVER_SNAPSHOT;
    try {
        return window.localStorage.getItem(STORAGE_KEY) ?? SERVER_SNAPSHOT;
    } catch {
        return SERVER_SNAPSHOT;
    }
}

function getServerSnapshot(): string {
    return SERVER_SNAPSHOT;
}

function readCurrent(): PreferencesState {
    if (typeof window === "undefined") return DEFAULT_PREFERENCES;
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        return stored ? sanitizePreferences(JSON.parse(stored)) : DEFAULT_PREFERENCES;
    } catch {
        return DEFAULT_PREFERENCES;
    }
}

function writePreferences(updater: (prev: PreferencesState) => PreferencesState) {
    if (typeof window === "undefined") return;
    const prev = readCurrent();
    const next = updater(prev);
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (err) {
        console.warn("Failed to persist preferences", err);
        return;
    }
    window.dispatchEvent(new Event(PREFERENCES_CHANGE_EVENT));
}

function runMigrations() {
    if (typeof window === "undefined") return;
    const storage = window.localStorage;
    let current = readCurrent();
    let mutated = false;

    if (!storage.getItem(LIVE_STATS_MIGRATION_KEY)) {
        storage.setItem(LIVE_STATS_MIGRATION_KEY, "1");
        if (!current.showLiveStatsDuringRun) {
            current = { ...current, showLiveStatsDuringRun: true };
            mutated = true;
        }
    }
    if (!storage.getItem(COUNTDOWN_MIGRATION_KEY)) {
        storage.setItem(COUNTDOWN_MIGRATION_KEY, "1");
        if (current.countdownEnabled === true) {
            current = { ...current, countdownEnabled: false };
            mutated = true;
        }
    }
    if (!storage.getItem(VIM_MODE_MIGRATION_KEY)) {
        storage.setItem(VIM_MODE_MIGRATION_KEY, "1");
        if (current.vimMode === true) {
            current = { ...current, vimMode: false };
            mutated = true;
        }
    }

    if (mutated) {
        try {
            storage.setItem(STORAGE_KEY, JSON.stringify(current));
        } catch (err) {
            console.warn("Failed to persist migrated preferences", err);
            return;
        }
        window.dispatchEvent(new Event(PREFERENCES_CHANGE_EVENT));
    }
}

const setTheme = (theme: ThemePreset) => writePreferences((prev) => ({ ...prev, theme }));
const setFontSize = (size: number) =>
    writePreferences((prev) => ({ ...prev, fontSize: Math.min(36, Math.max(16, Math.round(size))) }));
const setCaretWidth = (width: number) =>
    writePreferences((prev) => ({ ...prev, caretWidth: Math.min(6, Math.max(2, Number(width))) }));
const setCountdownEnabled = (countdownEnabled: boolean) =>
    writePreferences((prev) => ({ ...prev, countdownEnabled }));
const setSurfaceStyle = (surfaceStyle: SurfaceStyle) =>
    writePreferences((prev) => ({ ...prev, surfaceStyle }));
const setShowLiveStatsDuringRun = (showLiveStatsDuringRun: boolean) =>
    writePreferences((prev) => ({ ...prev, showLiveStatsDuringRun }));
const setInterfaceMode = (interfaceMode: InterfaceMode) =>
    writePreferences((prev) => ({ ...prev, interfaceMode }));
const setRequireTabForIndent = (requireTabForIndent: boolean) =>
    writePreferences((prev) => ({ ...prev, requireTabForIndent }));
const setSyntaxHighlighting = (syntaxHighlighting: SyntaxHighlightingMode) =>
    writePreferences((prev) => ({ ...prev, syntaxHighlighting }));
const setVimMode = (vimMode: boolean) =>
    writePreferences((prev) => ({ ...prev, vimMode }));
const setDebugGapBuffer = (debugGapBuffer: boolean) =>
    writePreferences((prev) => ({ ...prev, debugGapBuffer }));
const setSpacedRepetitionEnabled = (spacedRepetitionEnabled: boolean) =>
    writePreferences((prev) => ({ ...prev, spacedRepetitionEnabled }));
const setAdaptiveDifficultyEnabled = (adaptiveDifficultyEnabled: boolean) =>
    writePreferences((prev) => ({ ...prev, adaptiveDifficultyEnabled }));
const setAIDrillsEnabled = (aiDrillsEnabled: boolean) =>
    writePreferences((prev) => ({ ...prev, aiDrillsEnabled }));
const setAIProvider = (aiProvider: "claude" | "openai" | "fireworks") =>
    writePreferences((prev) => ({ ...prev, aiProvider }));
const setAIMaxDrillsPerDay = (limit: number) =>
    writePreferences((prev) => ({ ...prev, aiMaxDrillsPerDay: Math.min(1000, Math.max(1, Math.round(limit))) }));
const setAIAutoGenerate = (aiAutoGenerate: boolean) =>
    writePreferences((prev) => ({ ...prev, aiAutoGenerate }));
const setAIDrillLengthPreference = (aiDrillLengthPreference: SnippetLength | "auto") =>
    writePreferences((prev) => ({ ...prev, aiDrillLengthPreference }));

const PREFERENCE_SETTERS = {
    setTheme,
    setFontSize,
    setCaretWidth,
    setCountdownEnabled,
    setSurfaceStyle,
    setShowLiveStatsDuringRun,
    setInterfaceMode,
    setRequireTabForIndent,
    setSyntaxHighlighting,
    setVimMode,
    setDebugGapBuffer,
    setSpacedRepetitionEnabled,
    setAdaptiveDifficultyEnabled,
    setAIDrillsEnabled,
    setAIProvider,
    setAIMaxDrillsPerDay,
    setAIAutoGenerate,
    setAIDrillLengthPreference,
} as const;

export function PreferencesProvider({ children }: { children: ReactNode }) {
    const storedJson = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    const preferences = useMemo<PreferencesState>(() => {
        try {
            return sanitizePreferences(JSON.parse(storedJson));
        } catch {
            return DEFAULT_PREFERENCES;
        }
    }, [storedJson]);

    useEffect(() => {
        runMigrations();
    }, []);

    useEffect(() => {
        applyTheme(preferences);
    }, [preferences]);

    useEffect(() => {
        if (typeof document === "undefined") return;
        document.documentElement.setAttribute("data-interface", preferences.interfaceMode);
    }, [preferences.interfaceMode]);

    const value = useMemo<PreferencesContextValue>(
        () => ({ preferences, ...PREFERENCE_SETTERS }),
        [preferences],
    );

    return (
        <PreferencesContext.Provider value={value}>
            {children}
        </PreferencesContext.Provider>
    );
}

export function usePreferences() {
    const context = use(PreferencesContext);
    if (!context) throw new Error("usePreferences must be used within PreferencesProvider");
    return context;
}

export { DEFAULT_PREFERENCES, THEME_PRESETS } from "@/lib/preferences-core";
export type {
    ThemePreset,
    SurfaceStyle,
    InterfaceMode,
    PreferencesState,
    SyntaxHighlightingMode,
    SnippetLength,
} from "@/lib/preferences-core";
