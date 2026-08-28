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
const STATS = ["4 languages", "1,800+ snippets", "syntax-aware scoring"].join("  ·  ");

/**
 * Satori has no built-in monospace face, so the subsetted TTF is pulled from
 * Google Fonts at render time. The whole image is prerendered at build; if the
 * network is unavailable the layout still renders in the bundled fallback face
 * rather than failing the build.
 */
async function loadMonoFont(weight: 400 | 700, text: string): Promise<ArrayBuffer | null> {
    try {
        const cssUrl = `https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@${weight}&text=${encodeURIComponent(text)}`;
        const css = await fetch(cssUrl).then((response) => response.text());
        const fontUrl = css.match(/src: url\(([^)]+)\) format\('(?:opentype|truetype)'\)/)?.[1];
        if (!fontUrl) return null;
        return await fetch(fontUrl).then((response) => response.arrayBuffer());
    } catch {
        return null;
    }
}

export default async function OpengraphImage() {
    const glyphs = [WORDMARK, EYEBROW, SITE_TAGLINE, CODE_TYPED, CODE_REST, STATS].join("");
    const [regular, bold] = await Promise.all([
        loadMonoFont(400, glyphs),
        loadMonoFont(700, glyphs),
    ]);

    const fonts = [
        regular && { name: "JetBrains Mono", data: regular, weight: 400 as const, style: "normal" as const },
        bold && { name: "JetBrains Mono", data: bold, weight: 700 as const, style: "normal" as const },
    ].filter((font) => font !== null);

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
        { ...size, fonts: fonts.length > 0 ? fonts : undefined },
    );
}
