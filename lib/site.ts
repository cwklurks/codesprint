/**
 * Canonical site identity, shared by the root metadata, the OG image, the web
 * manifest, robots.txt and the sitemap so the strings can never drift apart.
 *
 * NEXT_PUBLIC_SITE_URL overrides the default for preview and self-hosted
 * deployments. The default is the domain the share card already watermarks
 * (lib/share-card.ts).
 */

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://codesprint.dev";

export const SITE_NAME = "CodeSprint";

export const SITE_TITLE = "CodeSprint · Code Typing Trainer";

export const SITE_TAGLINE = "Build real syntax muscle memory.";

export const SITE_DESCRIPTION =
    "Practice 900+ real LeetCode snippets in Python, JavaScript, Java, and C++ with syntax-aware scoring, spaced repetition, and adaptive difficulty.";

/** Gruvbox background, the default theme. Used for themeColor and PWA chrome. */
export const SITE_THEME_COLOR = "#282828";
