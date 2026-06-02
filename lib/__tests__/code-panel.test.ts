import { describe, expect, it } from "vitest";
import {
    estimateEditorHeight,
    getPreviewIndex,
    hexToRgb,
    normalizeHexColor,
    toMonacoColor,
    withMonacoAlpha,
} from "../code-panel";

describe("normalizeHexColor", () => {
    it("expands 3-digit hex colors", () => {
        expect(normalizeHexColor("#fff")).toBe("#ffffff");
        expect(normalizeHexColor("#abc")).toBe("#aabbcc");
    });

    it("leaves 6-digit hex colors unchanged", () => {
        expect(normalizeHexColor("#18181a")).toBe("#18181a");
    });
});

describe("hexToRgb", () => {
    it("supports normalized short hex values", () => {
        expect(hexToRgb("#fff")).toEqual([255, 255, 255]);
        expect(hexToRgb("#18181a")).toEqual([24, 24, 26]);
    });
});

describe("toMonacoColor", () => {
    it("normalizes short hex colors into Monaco-safe values", () => {
        expect(toMonacoColor("#fff")).toBe("#ffffff");
    });

    it("converts rgba colors into hex with alpha", () => {
        expect(toMonacoColor("rgba(255, 255, 255, 0.25)")).toBe("#ffffff40");
    });
});

describe("withMonacoAlpha", () => {
    it("applies opacity to normalized short hex colors", () => {
        expect(withMonacoAlpha("#fff", 0.25)).toBe("#ffffff40");
    });

    it("replaces any existing alpha channel", () => {
        expect(withMonacoAlpha("#ffffff80", 0.5)).toBe("#ffffff80");
        expect(withMonacoAlpha("rgba(24, 24, 26, 0.9)", 0.25)).toBe("#18181a40");
    });
});

describe("estimateEditorHeight", () => {
    it("floors short snippets at the minimum height", () => {
        // (1 line + 4 buffer) * round(14 * 1.55=22) = 110 -> clamped up to MIN 320
        expect(estimateEditorHeight("one line", 14)).toBe(320);
    });

    it("grows past the old 720px cap for long snippets (no max clamp)", () => {
        const content = Array.from({ length: 50 }, (_, i) => `line ${i}`).join("\n");
        // (50 + 4) * 22 = 1188, well above the former 720 cap
        expect(estimateEditorHeight(content, 14)).toBe(1188);
    });

    it("scales line height with font size", () => {
        const content = Array.from({ length: 40 }, () => "x").join("\n");
        // round(20 * 1.55) = 31; (40 + 4) * 31 = 1364
        expect(estimateEditorHeight(content, 20)).toBe(1364);
    });
});

describe("getPreviewIndex", () => {
    it("reveals upcoming characters on the same line", () => {
        expect(getPreviewIndex("abcdefghijk", 3, 4)).toBe(7);
    });

    it("stops before the next line break", () => {
        expect(getPreviewIndex("const x = 1;\nnext line", 8, 12)).toBe(12);
    });

    it("clamps at the end of the content", () => {
        expect(getPreviewIndex("short", 4, 10)).toBe(5);
    });
});
