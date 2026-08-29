import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export const alt = `${SITE_NAME} — a code typing trainer`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Gruvbox, the default preset (lib/preferences-core.ts).
const BG = "#282828";
const BG_MUTED = "#3c3836";
const TEXT = "#ebdbb2";
const TEXT_SUBTLE = "#a89984";
const ACCENT = "#d79921";
const BORDER = "rgba(168, 153, 132, 0.28)";

const WORDMARK = "codesprint";
const EYEBROW = "CODE TYPING TRAINER";
const CODE_TYPED = "def two_sum(nums,";
const CODE_REST = "target):";
const STATS = ["4 languages", "900+ snippets", "syntax-aware scoring"].join("  ·  ");

/**
 * Satori has no built-in monospace face, so the wordmark needs a real TTF.
 *
 * These used to be fetched from Google Fonts at render time, which made the
 * card's typography depend on the build machine's network: when the 700 weight
 * failed the wordmark silently fell back to a proportional sans. The
 * faces are vendored under `assets/fonts/` (JetBrains Mono 2.304, SIL OFL 1.1 —
 * see `assets/fonts/OFL.txt`) and read off disk instead, so the render is
 * hermetic.
 */
const FONT_FILES = {
    400: "JetBrainsMono-Regular.ttf",
    700: "JetBrainsMono-Bold.ttf",
} as const;

async function loadMonoFonts(): Promise<
    { name: string; data: Buffer; weight: 400 | 700; style: "normal" }[]
> {
    const weights = [400, 700] as const;
    return Promise.all(
        weights.map(async (weight) => ({
            name: "JetBrains Mono",
            data: await readFile(join(process.cwd(), "assets", "fonts", FONT_FILES[weight])),
            weight,
            style: "normal" as const,
        })),
    );
}

export default async function OpengraphImage() {
    const fonts = await loadMonoFonts();

    return new ImageResponse(
        (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    padding: 72,
                    background: `linear-gradient(150deg, ${BG} 0%, ${BG} 55%, ${BG_MUTED} 100%)`,
                    fontFamily: "JetBrains Mono",
                    color: TEXT,
                }}
            >
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        borderRadius: 24,
                        border: `1px solid ${BORDER}`,
                        background: "rgba(60, 56, 54, 0.55)",
                        padding: "56px 60px",
                    }}
                >
                    <div style={{ display: "flex", fontSize: 24, letterSpacing: 6, color: TEXT_SUBTLE }}>
                        {EYEBROW}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", marginTop: 24 }}>
                        <div style={{ display: "flex", fontSize: 108, fontWeight: 700, letterSpacing: -2 }}>
                            {WORDMARK}
                        </div>
                        <div
                            style={{
                                display: "flex",
                                width: 18,
                                height: 96,
                                marginLeft: 16,
                                borderRadius: 3,
                                background: ACCENT,
                            }}
                        />
                    </div>

                    <div style={{ display: "flex", fontSize: 36, marginTop: 20, color: TEXT_SUBTLE }}>
                        {SITE_TAGLINE}
                    </div>

                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            marginTop: 44,
                            padding: "22px 28px",
                            borderRadius: 16,
                            border: `1px solid ${BORDER}`,
                            background: "rgba(40, 40, 40, 0.75)",
                            fontSize: 34,
                        }}
                    >
                        <div style={{ display: "flex", color: ACCENT }}>{CODE_TYPED}</div>
                        <div style={{ display: "flex", marginLeft: 14, color: TEXT_SUBTLE }}>{CODE_REST}</div>
                    </div>

                    <div style={{ display: "flex", marginTop: 40, fontSize: 26, color: TEXT_SUBTLE }}>
                        {STATS}
                    </div>
                </div>
            </div>
        ),
        { ...size, fonts },
    );
}
