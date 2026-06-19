import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getDailyNumber, getDateForDailyNumber } from "@/lib/daily";
import { barFilledCells, BAR_CELLS, parseDay, parseShareParams, type ShareParams } from "@/lib/og-params";
import { getSiteUrl } from "@/lib/site";
import { getLocalDateString } from "@/lib/streaks";

const BAR_FILLED = "█";
const BAR_EMPTY = "░";

type PageProps = {
    params: Promise<{ day: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? undefined : value;
}

function readShareParams(raw: Record<string, string | string[] | undefined>): ShareParams {
    return parseShareParams({
        w: firstValue(raw.w),
        a: firstValue(raw.a),
        s: firstValue(raw.s),
        l: firstValue(raw.l),
    });
}

// Builds /api/og?day=..&w=..&a=..&s=..&l=.. from validated params only.
function ogImageUrl(day: number, share: ShareParams): string {
    const query = new URLSearchParams({ day: String(day) });
    if (share.w !== undefined) query.set("w", String(share.w));
    if (share.a !== undefined) query.set("a", String(share.a));
    if (share.s !== undefined) query.set("s", String(share.s));
    if (share.l !== undefined) query.set("l", share.l);
    return `/api/og?${query.toString()}`;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
    const day = parseDay((await params).day);
    if (day === null) {
        return { title: "CodeSprint Daily" };
    }
    const share = readShareParams(await searchParams);
    const title = `CodeSprint Daily #${day}`;
    const description =
        share.w !== undefined
            ? `${share.w} wpm · ${share.a ?? 0}% acc · can you beat it?`
            : "Take today's date-seeded Daily and build your streak.";
    const image = `${getSiteUrl()}${ogImageUrl(day, share)}`;

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            type: "website",
            images: [image],
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
            images: [image],
        },
    };
}

// Signature lines 1-3 (spoiler-free). Line 4 (the URL) is intentionally omitted.
function signatureLines(day: number, share: ShareParams): string[] {
    const wpm = share.w ?? 0;
    const filled = barFilledCells(wpm);
    const bar = BAR_FILLED.repeat(filled) + BAR_EMPTY.repeat(BAR_CELLS - filled);
    return [
        `CodeSprint #${day}${share.l ? ` ${share.l}` : ""}`,
        `${bar} ${wpm} wpm`,
        `${share.a ?? 0}% acc · 🔥 ${share.s ?? 0}`,
    ];
}

export default async function DailyResultPage({ params, searchParams }: PageProps) {
    const day = parseDay((await params).day);
    if (day === null) {
        notFound();
    }

    const share = readShareParams(await searchParams);
    const date = getDateForDailyNumber(day);
    const todayNumber = getDailyNumber(getLocalDateString());
    const hasResult = share.w !== undefined;
    const isPast = day !== todayNumber;

    return (
        <main
            style={{
                minHeight: "100vh",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 28,
                padding: "48px 24px",
                background: "var(--bg)",
                color: "var(--text)",
                fontFamily: "var(--font-mono)",
                textAlign: "center",
            }}
        >
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "0.02em" }}>codesprint</div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <h1 style={{ fontSize: 40, fontWeight: 700, margin: 0 }}>Daily #{day}</h1>
                <div style={{ fontSize: 16, color: "var(--text-subtle)" }}>{date}</div>
            </div>

            {hasResult && (
                <pre
                    style={{
                        margin: 0,
                        padding: "20px 24px",
                        fontFamily: "var(--font-mono)",
                        fontSize: 18,
                        lineHeight: 1.6,
                        color: "var(--text)",
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: 10,
                        textAlign: "left",
                    }}
                >
                    {signatureLines(day, share).join("\n")}
                </pre>
            )}

            {isPast && (
                <div style={{ fontSize: 15, color: "var(--text-subtle)" }}>
                    This daily has passed - today&apos;s challenge is live.
                </div>
            )}

            <Link
                href="/"
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "14px 28px",
                    fontSize: 18,
                    fontWeight: 700,
                    color: "var(--bg)",
                    background: "var(--accent)",
                    borderRadius: 999,
                    textDecoration: "none",
                }}
            >
                Type today&apos;s daily
            </Link>
        </main>
    );
}
