import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

import { barFilledCells, BAR_CELLS, parseDay, parseShareParams } from "@/lib/og-params";
import { getSiteHost } from "@/lib/site";

export const runtime = "edge";

// "Stopwatch" palette — a precision sport instrument.
const COLORS = {
    bg: "#0b0e14",
    text: "#e6edf3",
    muted: "#8b949e",
    accent: "#2dd4bf",
    barEmpty: "#21262d",
} as const;

const SIZE = { width: 1200, height: 630 };

async function loadFonts() {
    const [regular, bold] = await Promise.all([
        fetch(new URL("./JetBrainsMono-Regular.ttf", import.meta.url)).then((res) =>
            res.arrayBuffer(),
        ),
        fetch(new URL("./JetBrainsMono-Bold.ttf", import.meta.url)).then((res) =>
            res.arrayBuffer(),
        ),
    ]);
    return [
        { name: "JetBrains Mono", data: regular, style: "normal" as const, weight: 400 as const },
        { name: "JetBrains Mono", data: bold, style: "normal" as const, weight: 700 as const },
    ];
}

function Bar({ filled }: { filled: number }) {
    return (
        <div style={{ display: "flex", flexDirection: "row", gap: 8 }}>
            {Array.from({ length: BAR_CELLS }, (_, i) => (
                <div
                    key={i}
                    style={{
                        width: 40,
                        height: 28,
                        borderRadius: 6,
                        backgroundColor: i < filled ? COLORS.accent : COLORS.barEmpty,
                    }}
                />
            ))}
        </div>
    );
}

function ResultCard({
    day,
    wpm,
    acc,
    streak,
    lang,
}: {
    day: number;
    wpm: number;
    acc?: number;
    streak?: number;
    lang?: string;
}) {
    const filled = barFilledCells(wpm);
    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                backgroundColor: COLORS.bg,
                color: COLORS.text,
                padding: 64,
                fontFamily: "JetBrains Mono",
            }}
        >
            {/* Top row: wordmark + daily badge */}
            <div
                style={{
                    display: "flex",
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}
            >
                <div style={{ fontSize: 34, fontWeight: 700, color: COLORS.text }}>codesprint</div>
                <div style={{ fontSize: 28, color: COLORS.muted }}>
                    {`Daily #${day}${lang ? ` · ${lang}` : ""}`}
                </div>
            </div>

            {/* Center: giant WPM */}
            <div
                style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-end" }}>
                    <div style={{ display: "flex", fontSize: 190, fontWeight: 700, lineHeight: 1, color: COLORS.text }}>
                        {wpm}
                    </div>
                    <div
                        style={{
                            display: "flex",
                            fontSize: 36,
                            color: COLORS.muted,
                            paddingBottom: 28,
                            paddingLeft: 16,
                        }}
                    >
                        wpm
                    </div>
                </div>

                <div style={{ display: "flex", marginTop: 40 }}>
                    <Bar filled={filled} />
                </div>

                {(acc !== undefined || streak !== undefined) && (
                    <div style={{ display: "flex", fontSize: 32, color: COLORS.muted, marginTop: 28 }}>
                        {`${acc ?? 0}% acc · 🔥 ${streak ?? 0}`}
                    </div>
                )}
            </div>

            {/* Bottom: host */}
            <div style={{ display: "flex", fontSize: 26, color: COLORS.muted }}>{getSiteHost()}</div>
        </div>
    );
}

function GenericCard() {
    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                backgroundColor: COLORS.bg,
                color: COLORS.text,
                padding: 64,
                fontFamily: "JetBrains Mono",
            }}
        >
            <div style={{ fontSize: 96, fontWeight: 700, color: COLORS.text }}>codesprint</div>
            <div style={{ fontSize: 40, color: COLORS.accent, marginTop: 16 }}>
                the typing sport for code
            </div>
            <div style={{ display: "flex", flex: 1 }} />
            <div style={{ display: "flex", fontSize: 26, color: COLORS.muted }}>{getSiteHost()}</div>
        </div>
    );
}

export async function GET(req: NextRequest) {
    const params = req.nextUrl.searchParams;
    const day = parseDay(params.get("day") ?? undefined);
    const share = parseShareParams({
        w: params.get("w") ?? undefined,
        a: params.get("a") ?? undefined,
        s: params.get("s") ?? undefined,
        l: params.get("l") ?? undefined,
    });

    const fonts = await loadFonts();

    // A result card needs a valid day AND a wpm; otherwise fall back to the brand card.
    const element =
        day !== null && share.w !== undefined ? (
            <ResultCard day={day} wpm={share.w} acc={share.a} streak={share.s} lang={share.l} />
        ) : (
            <GenericCard />
        );

    return new ImageResponse(element, { ...SIZE, fonts });
}
