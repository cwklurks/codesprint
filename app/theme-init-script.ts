import {
  DEFAULT_PREFERENCES,
  STORAGE_KEY,
  THEME_PRESETS,
} from "@/lib/preferences-core";

export function createThemeInitScript(): string {
  const defaults = JSON.stringify(DEFAULT_PREFERENCES);
  const themes = JSON.stringify(THEME_PRESETS);
  const storageKey = JSON.stringify(STORAGE_KEY);
  return `
(() => {
  const STORAGE_KEY = ${storageKey};
  const DEFAULTS = ${defaults};
  const THEMES = ${themes};

  const clampNumber = (input, min, max, fallback) => {
    const value = Number(input);
    if (!Number.isFinite(value)) return fallback;
    if (value < min) return min;
    if (value > max) return max;
    return value;
  };

  const computeCaretHeight = (fontSize) => Math.round(fontSize * 1.55);

  const sanitize = (value) => {
    if (!value || typeof value !== "object") return { ...DEFAULTS };
    const maybeTheme = typeof value.theme === "string" ? value.theme : undefined;
    const theme = maybeTheme && Object.prototype.hasOwnProperty.call(THEMES, maybeTheme) ? maybeTheme : DEFAULTS.theme;
    const fontSize = Math.round(clampNumber(value.fontSize, 16, 36, DEFAULTS.fontSize));
    const caretWidth = clampNumber(value.caretWidth, 2, 6, DEFAULTS.caretWidth);
    const countdownEnabled =
      typeof value.countdownEnabled === "boolean" ? value.countdownEnabled : DEFAULTS.countdownEnabled;
    const surfaceStyle =
      value.surfaceStyle === "panel" || value.surfaceStyle === "immersive" ? value.surfaceStyle : DEFAULTS.surfaceStyle;
    const showLiveStatsDuringRun =
      typeof value.showLiveStatsDuringRun === "boolean"
        ? value.showLiveStatsDuringRun
        : DEFAULTS.showLiveStatsDuringRun;
    const interfaceMode = value.interfaceMode === "terminal" ? "terminal" : DEFAULTS.interfaceMode;

    return {
      theme,
      fontSize,
      caretWidth,
      countdownEnabled,
      surfaceStyle,
      showLiveStatsDuringRun,
      interfaceMode,
    };
  };

  const applyTheme = (preferences) => {
    const tokens = THEMES[preferences.theme] || THEMES[DEFAULTS.theme];
    if (!tokens) return;
    const root = document.documentElement;
    if (!root) return;
    const bgColor = preferences.interfaceMode === "terminal" ? tokens.terminalBg : tokens.bg;
    const bgGradient =
      preferences.interfaceMode === "terminal"
        ? \`linear-gradient(180deg, \${tokens.terminalBg} 0%, \${tokens.terminalBg} 100%)\`
        : tokens.bgGradient;

    root.style.setProperty("--bg-base", tokens.bg);
    root.style.setProperty("--bg", bgColor);
    root.style.setProperty("--bg-muted", tokens.bgMuted);
    root.style.setProperty("--bg-gradient", bgGradient);
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
    root.style.setProperty("--caret-width", preferences.caretWidth + "px");
    root.style.setProperty("--caret-height", computeCaretHeight(preferences.fontSize) + "px");
    root.style.setProperty("--editor-font-size", preferences.fontSize + "px");
    root.setAttribute("data-interface", preferences.interfaceMode);
  };

  try {
    const raw = typeof window !== "undefined" && window.localStorage ? window.localStorage.getItem(STORAGE_KEY) : null;
    const parsed = raw ? JSON.parse(raw) : null;
    const preferences = sanitize(parsed);
    applyTheme(preferences);
  } catch (_error) {
    applyTheme({ ...DEFAULTS });
  }
})();
`.trim();
}


