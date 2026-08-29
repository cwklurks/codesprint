import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import AppShell from "@/components/AppShell";
import {
    SITE_DESCRIPTION,
    SITE_NAME,
    SITE_THEME_COLOR,
    SITE_TITLE,
    SITE_URL,
} from "@/lib/site";
import { AppProviders } from "./providers";
import { createThemeInitScript } from "./theme-init-script";

// Variable font: one file covers every weight the UI uses. Exposed as
// --font-jetbrains and consumed only through --font-mono (app/globals.css).
const jetbrainsMono = JetBrains_Mono({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-jetbrains",
});

export const metadata: Metadata = {
    metadataBase: new URL(SITE_URL),
    title: {
        default: SITE_TITLE,
        template: `%s · ${SITE_NAME}`,
    },
    description: SITE_DESCRIPTION,
    applicationName: SITE_NAME,
    keywords: [
        "typing practice",
        "code typing test",
        "programming typing trainer",
        "wpm test for developers",
        "leetcode snippets",
        "syntax muscle memory",
    ],
    authors: [{ name: "cwklurks", url: "https://github.com/cwklurks" }],
    creator: "cwklurks",
    alternates: { canonical: "/" },
    openGraph: {
        type: "website",
        url: SITE_URL,
        siteName: SITE_NAME,
        title: SITE_TITLE,
        description: SITE_DESCRIPTION,
        locale: "en_US",
    },
    twitter: {
        card: "summary_large_image",
        title: SITE_TITLE,
        description: SITE_DESCRIPTION,
    },
    robots: {
        index: true,
        follow: true,
        googleBot: { index: true, follow: true, "max-image-preview": "large" },
    },
    appleWebApp: {
        capable: true,
        title: SITE_NAME,
        statusBarStyle: "black-translucent",
    },
    formatDetection: { telephone: false },
};

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    // The app boots into gruvbox before any stored preference is read, so the
    // browser chrome matches the first paint. (Serika is the one light preset.)
    themeColor: SITE_THEME_COLOR,
    colorScheme: "dark light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    const themeInitScript = createThemeInitScript();
    return (
        <html lang="en" className={jetbrainsMono.variable}>
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
