import { describe, expect, it } from "vitest";
import { csvEscape } from "../export";

describe("csvEscape", () => {
    it.each([
        ["=HYPERLINK(\"https://example.test\")", "'=HYPERLINK(\"https://example.test\")"],
        ["+cmd|' /C calc'!A0", "'+cmd|' /C calc'!A0"],
        ["-2+3", "'-2+3"],
        ["@SUM(1,2)", "'@SUM(1,2)"],
        ["   =1+1", "'   =1+1"],
        ["\t=1+1", "'\t=1+1"],
    ])("neutralizes formula-like string cells before quoting", (input, neutralized) => {
        const escaped = csvEscape(input);

        expect(escaped.replace(/^\"|\"$/g, "").replace(/\"\"/g, "\"")).toBe(neutralized);
    });

    it("does not alter numeric values", () => {
        expect(csvEscape(-42)).toBe("-42");
    });
});
