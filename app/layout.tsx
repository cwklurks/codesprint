import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { getSiteUrl } from "@/lib/site";
import { AppProviders } from "./providers";
import { createThemeInitScript } from "./theme-init-script";

export const metadata: Metadata = {
    metadataBase: new URL(getSiteUrl()),
    title: "CodeSprint - the typing sport for code",
    description:
        "Sharpen your code-typing speed and accuracy. Take the date-seeded Daily, build a streak, and share your result.",
    openGraph: {
        siteName: "CodeSprint",
        type: "website",
        url: getSiteUrl(),
        title: "CodeSprint - the typing sport for code",
        description:
            "Sharpen your code-typing speed and accuracy. Take the date-seeded Daily, build a streak, and share your result.",
        images: ["/api/og"],
    },
    twitter: {
        card: "summary_large_image",
        title: "CodeSprint - the typing sport for code",
        description:
            "Sharpen your code-typing speed and accuracy. Take the date-seeded Daily, build a streak, and share your result.",
        images: ["/api/og"],
    },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    const themeInitScript = createThemeInitScript();
    return (
        <html lang="en">
            <body>
                <Script id="codesprint-theme-init" strategy="beforeInteractive">
                    {themeInitScript}
                </Script>
                <AppProviders>
                    <AppShell>{children}</AppShell>
                </AppProviders>
            </body>
        </html>
    );
}
