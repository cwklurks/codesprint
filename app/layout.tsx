import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import AppShell from "@/components/AppShell";
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
    title: "codesprint",
    description: "codesprint",
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
