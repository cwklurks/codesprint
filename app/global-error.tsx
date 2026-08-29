"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary: it replaces the root layout, so neither the theme
 * provider nor the app stylesheet is guaranteed to be present. Everything here
 * is inline and self-sufficient, using the gruvbox defaults the app boots with.
 */
const BG = "#282828";
const PANEL = "#3c3836";
const TEXT = "#ebdbb2";
const TEXT_SUBTLE = "#a89984";
const ACCENT = "#d79921";
const BORDER = "rgba(168, 153, 132, 0.3)";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("Global error:", error);
    }, [error]);

    return (
        <html lang="en">
            <body
                style={{
                    margin: 0,
                    minHeight: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: BG,
                    color: TEXT,
                    fontFamily: MONO,
                }}
            >
                <main
                    style={{
                        maxWidth: 480,
                        margin: 24,
                        padding: "40px 32px",
                        textAlign: "center",
                        borderRadius: 16,
                        border: `1px solid ${BORDER}`,
                        background: PANEL,
                    }}
                >
                    <p
                        style={{
                            margin: 0,
                            fontSize: 12,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            color: TEXT_SUBTLE,
                        }}
                    >
                        Something broke
                    </p>
                    <h1 style={{ margin: "12px 0 0", fontSize: 22 }}>CodeSprint could not load</h1>
                    <p style={{ margin: "12px 0 0", fontSize: 14, color: TEXT_SUBTLE }}>
                        Your session history is stored locally and is untouched. Reload to start
                        again.
                    </p>
                    {error.digest ? (
                        <p style={{ margin: "12px 0 0", fontSize: 12, color: TEXT_SUBTLE }}>
                            {error.digest}
                        </p>
                    ) : null}
                    <button
                        type="button"
                        onClick={reset}
                        style={{
                            marginTop: 24,
                            padding: "10px 20px",
                            fontFamily: MONO,
                            fontSize: 14,
                            fontWeight: 600,
                            color: BG,
                            background: ACCENT,
                            border: "none",
                            borderRadius: 8,
                            cursor: "pointer",
                        }}
                    >
                        Try again
                    </button>
                </main>
            </body>
        </html>
    );
}
