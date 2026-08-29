// @vitest-environment node
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import OpengraphImage, { alt, contentType, size } from "@/app/opengraph-image";

const FONT_DIR = join(process.cwd(), "assets", "fonts");

/** TrueType outlines start with the sfnt version 0x00010000. */
const SFNT_TRUETYPE = Buffer.from([0x00, 0x01, 0x00, 0x00]);

describe("bundled OG fonts", () => {
    it.each(["JetBrainsMono-Regular.ttf", "JetBrainsMono-Bold.ttf"])(
        "ships %s as a real TrueType file",
        async (file) => {
            const data = await readFile(join(FONT_DIR, file));
            expect(data.subarray(0, 4).equals(SFNT_TRUETYPE)).toBe(true);
            expect(data.byteLength).toBeGreaterThan(50_000);
        },
    );

    it("keeps the upstream OFL notice alongside them", async () => {
        const licence = await readFile(join(FONT_DIR, "OFL.txt"), "utf8");
        expect(licence).toContain("SIL OPEN FONT LICENSE");
    });

    it("no longer reaches for Google Fonts at render time", async () => {
        const source = await readFile(join(process.cwd(), "app", "opengraph-image.tsx"), "utf8");
        expect(source).not.toContain("fonts.googleapis.com");
        expect(source).not.toContain("await fetch(");
    });
});

describe("opengraph image route", () => {
    it("declares the 1200x630 PNG card", () => {
        expect(size).toEqual({ width: 1200, height: 630 });
        expect(contentType).toBe("image/png");
        expect(alt).toContain("code typing trainer");
    });

    it("renders a PNG with no network access", async () => {
        const response = await OpengraphImage();

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe("image/png");

        const bytes = Buffer.from(await response.arrayBuffer());
        // PNG magic; a satori failure would surface as a throw, not a short file.
        expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
        expect(bytes.byteLength).toBeGreaterThan(10_000);
    }, 60_000);
});
