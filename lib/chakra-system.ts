import { createSystem, defaultConfig, defineConfig, defineSlotRecipe } from "@chakra-ui/react";
import { sliderAnatomy, switchAnatomy } from "@chakra-ui/react/anatomy";

/**
 * CodeSprint's Chakra system.
 *
 * The app's real palette lives in CSS custom properties that the theme writers
 * (app/theme-init-script.ts pre-hydration, lib/preferences.tsx at runtime) set
 * on <html>. Stock Chakra components used to ignore all of it and render from
 * Chakra's own gray/red/green ramps. Mapping Chakra's semantic tokens onto those
 * same vars means Skeleton, Switch, CloseButton, Table, Input, Badge and every
 * `colorPalette=` usage follow the active theme for free -- and they keep
 * following it when the theme changes, because the vars are the source of truth.
 */

const MONO_STACK = "var(--font-mono), ui-monospace, Menlo, Consolas, monospace";

/** Chakra ramps a palette into subtle/muted/emphasized fills; do the same from one var. */
const tint = (variable: string, percent: number) => `color-mix(in srgb, ${variable} ${percent}%, transparent)`;

const statusPalette = (variable: string, contrast: string) => ({
    contrast: { value: contrast },
    fg: { value: variable },
    subtle: { value: tint(variable, 12) },
    muted: { value: tint(variable, 20) },
    emphasized: { value: tint(variable, 32) },
    solid: { value: variable },
    focusRing: { value: variable },
});

/**
 * Switch and slider tracks, in one place.
 *
 * Chakra's stock recipes paint the switch's off-track from `bg.emphasized` and
 * its on-track from `colorPalette.solid`. With our gray palette that resolves to
 * `--surface-hover` (alpha 0.2 -- invisible against the page, so the knob floats)
 * and `--text-subtle` (so "on" reads greyed-out rather than active). The slider's
 * unfilled remainder had the same problem. Every Switch/Slider in the app reads
 * from these, so there is one source of truth per control.
 */
const switchSlotRecipe = defineSlotRecipe({
    slots: switchAnatomy.keys(),
    variants: {
        variant: {
            solid: {
                control: {
                    bg: "var(--surface-active)",
                    borderWidth: "1px",
                    borderStyle: "solid",
                    borderColor: "var(--border)",
                    _checked: {
                        bg: "var(--accent)",
                        borderColor: "var(--accent)",
                    },
                },
                thumb: {
                    bg: "var(--text-subtle)",
                    _checked: { bg: "var(--bg)" },
                },
            },
        },
    },
});

const sliderSlotRecipe = defineSlotRecipe({
    slots: sliderAnatomy.keys(),
    variants: {
        variant: {
            outline: {
                // An inset ring rather than a border: the rail's height comes
                // from `--slider-track-size` and a real border would eat into it.
                track: {
                    bg: "var(--surface-active)",
                    boxShadow: "inset 0 0 0 1px var(--border)",
                },
                range: { bg: "var(--accent)" },
                thumb: {
                    bg: "var(--accent)",
                    borderColor: "var(--bg)",
                },
            },
        },
    },
});

const config = defineConfig({
    globalCss: {
        body: {
            fontFamily: "mono",
        },
    },
    theme: {
        slotRecipes: {
            switch: switchSlotRecipe,
            slider: sliderSlotRecipe,
        },
        tokens: {
            fonts: {
                body: { value: MONO_STACK },
                heading: { value: MONO_STACK },
                mono: { value: MONO_STACK },
            },
        },
        semanticTokens: {
            colors: {
                bg: {
                    DEFAULT: { value: "var(--bg)" },
                    subtle: { value: "var(--surface)" },
                    muted: { value: "var(--bg-muted)" },
                    emphasized: { value: "var(--surface-hover)" },
                    inverted: { value: "var(--text)" },
                    panel: { value: "var(--panel-soft)" },
                    error: { value: tint("var(--error)", 12) },
                    warning: { value: tint("var(--warning)", 12) },
                    success: { value: tint("var(--success)", 12) },
                    info: { value: tint("var(--accent)", 12) },
                },
                fg: {
                    DEFAULT: { value: "var(--text)" },
                    muted: { value: "var(--text-subtle)" },
                    subtle: { value: "var(--text-subtle)" },
                    inverted: { value: "var(--bg)" },
                    error: { value: "var(--error)" },
                    warning: { value: "var(--warning)" },
                    success: { value: "var(--success)" },
                    info: { value: "var(--accent)" },
                },
                border: {
                    DEFAULT: { value: "var(--border)" },
                    muted: { value: "var(--border)" },
                    subtle: { value: "var(--border)" },
                    emphasized: { value: "var(--border-strong)" },
                    inverted: { value: "var(--text)" },
                    error: { value: "var(--error)" },
                    warning: { value: "var(--warning)" },
                    success: { value: "var(--success)" },
                    info: { value: "var(--accent)" },
                },
                // `colorPalette="gray"` is Chakra's default palette, so this is what
                // unstyled stock components (Skeleton, Switch, Table...) resolve to.
                gray: {
                    contrast: { value: "var(--bg)" },
                    fg: { value: "var(--text)" },
                    subtle: { value: "var(--surface)" },
                    muted: { value: "var(--surface-hover)" },
                    emphasized: { value: "var(--surface-active)" },
                    solid: { value: "var(--text-subtle)" },
                    focusRing: { value: "var(--focus-ring)" },
                },
                red: statusPalette("var(--error)", "white"),
                green: statusPalette("var(--success)", "white"),
                yellow: statusPalette("var(--warning)", "black"),
            },
        },
    },
});

export const chakraSystem = createSystem(defaultConfig, config);
