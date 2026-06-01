import { describe, expect, it } from "vitest";
import {
    compositeOver,
    contrastRatio,
    minAlphaForContrast,
    relativeLuminance,
} from "../contrast";
import { THEME_PRESETS } from "../preferences-core";

describe("relativeLuminance", () => {
    it("returns 0 for black and 1 for white", () => {
        expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
        expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
    });

    it("expands 3-digit hex", () => {
        expect(relativeLuminance("#fff")).toBeCloseTo(relativeLuminance("#ffffff"), 5);
        expect(relativeLuminance("#000")).toBeCloseTo(relativeLuminance("#000000"), 5);
    });
});

describe("contrastRatio", () => {
    it("returns 21 for black against white", () => {
        expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    });

    it("returns 1 for identical colors", () => {
        expect(contrastRatio("#7b9c98", "#7b9c98")).toBeCloseTo(1, 5);
    });

    it("is symmetric in its arguments", () => {
        expect(contrastRatio("#123456", "#abcdef")).toBeCloseTo(
            contrastRatio("#abcdef", "#123456"),
            5,
        );
    });
});

describe("compositeOver", () => {
    it("returns the background when alpha is 0", () => {
        expect(compositeOver("#ffffff", "#000000", 0).toLowerCase()).toBe("#000000");
    });

    it("returns the foreground when alpha is 1", () => {
        expect(compositeOver("#ffffff", "#000000", 1).toLowerCase()).toBe("#ffffff");
    });

    it("blends halfway at alpha 0.5", () => {
        // white over black at 0.5 => mid grey (#808080 / #7f7f7f range)
        const result = compositeOver("#ffffff", "#000000", 0.5).toLowerCase();
        expect(["#7f7f7f", "#808080"]).toContain(result);
    });

    it("monotonically increases composited luminance with alpha (light fg over dark bg)", () => {
        const lowAlpha = relativeLuminance(compositeOver("#eaf1f3", "#7b9c98", 0.2));
        const midAlpha = relativeLuminance(compositeOver("#eaf1f3", "#7b9c98", 0.5));
        const highAlpha = relativeLuminance(compositeOver("#eaf1f3", "#7b9c98", 0.8));
        expect(midAlpha).toBeGreaterThan(lowAlpha);
        expect(highAlpha).toBeGreaterThan(midAlpha);
    });
});

describe("minAlphaForContrast", () => {
    it("returns an alpha in (0, 0.7] for a light-on-dark pair", () => {
        const alpha = minAlphaForContrast("#f5f7fb", "#05060a", 3.0);
        expect(alpha).toBeGreaterThan(0);
        expect(alpha).toBeLessThanOrEqual(0.7);
    });

    it("clamps to a max of ~0.7 so untyped text stays muted", () => {
        // A low-contrast pair where 3:1 is unreachable below the cap.
        const alpha = minAlphaForContrast("#eaf1f3", "#7b9c98", 3.0);
        expect(alpha).toBeLessThanOrEqual(0.7);
    });

    it("yields a composite meeting the target ratio whenever achievable under the cap", () => {
        const fg = "#f5f7fb";
        const bg = "#05060a";
        const alpha = minAlphaForContrast(fg, bg, 3.0);
        expect(contrastRatio(compositeOver(fg, bg, alpha), bg)).toBeGreaterThanOrEqual(3.0);
    });

    it("returns the SMALLEST alpha meeting the target (no over-brightening)", () => {
        const fg = "#f5f7fb";
        const bg = "#05060a";
        const alpha = minAlphaForContrast(fg, bg, 3.0);
        // A meaningfully smaller alpha should drop below the target.
        if (alpha > 0.02) {
            expect(contrastRatio(compositeOver(fg, bg, alpha - 0.02), bg)).toBeLessThan(3.0);
        }
    });
});

describe("untyped read-ahead contrast across every theme preset", () => {
    // Botanical's text-over-bg palette tops out at ~2.6:1 even at full opacity,
    // so 3:1 is physically unreachable for it. Every OTHER preset can and must
    // clear the WCAG 3:1 non-text/large floor at the derived alpha.
    const PALETTE_LIMITED = new Set(["botanical"]);

    it("hits >= 3:1 for text-over-bg at the chosen alpha on every reachable theme", () => {
        const failures: string[] = [];
        for (const [name, theme] of Object.entries(THEME_PRESETS)) {
            if (PALETTE_LIMITED.has(name)) continue;
            const alpha = minAlphaForContrast(theme.text, theme.bg, 3.0);
            const ratio = contrastRatio(compositeOver(theme.text, theme.bg, alpha), theme.bg);
            if (ratio < 3.0) {
                failures.push(`${name}: ${ratio.toFixed(2)}:1 at alpha ${alpha.toFixed(3)}`);
            }
        }
        expect(failures).toEqual([]);
    });

    it("never exceeds the muting cap and stays a meaningful improvement on palette-limited themes", () => {
        const theme = THEME_PRESETS.botanical;
        const alpha = minAlphaForContrast(theme.text, theme.bg, 3.0);
        expect(alpha).toBeLessThanOrEqual(0.7);
        const fixed = contrastRatio(compositeOver(theme.text, theme.bg, alpha), theme.bg);
        const broken = contrastRatio(compositeOver(theme.text, theme.bg, 0.25), theme.bg);
        // The theme's text simply can't reach 3:1, but the fix must still lift it
        // well clear of the near-invisible 0.25 baseline.
        expect(fixed).toBeGreaterThan(broken);
        expect(fixed).toBeGreaterThan(1.8);
    });

    it("regression guard: the old flat 0.25 alpha failed the 3:1 floor on these themes", () => {
        // Documents the bug being fixed: at alpha 0.25 the untyped composite was
        // effectively invisible on several themes (botanical, serika, solarized...).
        const ratioAt = (name: keyof typeof THEME_PRESETS) => {
            const theme = THEME_PRESETS[name];
            return contrastRatio(compositeOver(theme.text, theme.bg, 0.25), theme.bg);
        };
        expect(ratioAt("botanical")).toBeLessThan(3.0);
        expect(ratioAt("serika")).toBeLessThan(3.0);
        expect(ratioAt("solarized")).toBeLessThan(3.0);
    });
});
