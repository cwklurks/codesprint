import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { AppProviders } from "./providers";
import { createThemeInitScript } from "./theme-init-script";

export const metadata: Metadata = {
    title: "CodeSprint | Typing drills for engineers",
    description: "Deliberate practice for engineers with realistic snippets, live stats, and shortcuts.",
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
