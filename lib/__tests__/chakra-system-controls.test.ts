import { describe, it, expect } from "vitest";
import { chakraSystem } from "@/lib/chakra-system";

/**
 * The switch and slider tracks are themed once, in the system's slot recipes,
 * so these assert against the merged system rather than the literal we wrote --
 * a partial slot recipe that failed to merge would still look right in source.
 */
describe("switch slot recipe", () => {
    const recipe = chakraSystem.getSlotRecipe("switch");
    const solid = recipe.variants.variant.solid;

    it("stays the default variant, so every Switch picks these up", () => {
        expect(recipe.defaultVariants.variant).toBe("solid");
    });

    it("fills the checked track with the accent rather than the muted text colour", () => {
        expect(solid.control._checked.bg).toBe("var(--accent)");
    });

    it("gives the unchecked track a visible surface and border", () => {
        expect(solid.control.bg).toBe("var(--surface-active)");
        expect(solid.control.borderWidth).toBe("1px");
        expect(solid.control.borderColor).toBe("var(--border)");
    });

    it("keeps the knob readable against both track states", () => {
        expect(solid.thumb.bg).toBe("var(--text-subtle)");
        expect(solid.thumb._checked.bg).toBe("var(--bg)");
    });

    it("leaves the untouched slots from the stock recipe intact", () => {
        expect(recipe.slots).toContain("thumb");
        expect(recipe.base.control.borderRadius).toBe("full");
    });
});

describe("slider slot recipe", () => {
    const recipe = chakraSystem.getSlotRecipe("slider");
    const outline = recipe.variants.variant.outline;

    it("stays the default variant, so every Slider picks these up", () => {
        expect(recipe.defaultVariants.variant).toBe("outline");
    });

    it("gives the unfilled remainder a visible rail", () => {
        expect(outline.track.bg).toBe("var(--surface-active)");
        expect(outline.track.boxShadow).toContain("var(--border)");
    });

    it("fills the selected range and the knob with the accent", () => {
        expect(outline.range.bg).toBe("var(--accent)");
        expect(outline.thumb.bg).toBe("var(--accent)");
    });
});
