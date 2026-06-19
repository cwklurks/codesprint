/**
 * Canonical site URL resolution, importable from both client and server code.
 *
 * NEXT_PUBLIC_ env vars are inlined into the client bundle at build time, so the
 * full literal `process.env.NEXT_PUBLIC_*` references below are required for the
 * client-side values to resolve correctly.
 */

function stripTrailingSlashes(url: string): string {
    return url.replace(/\/+$/, "");
}

/**
 * Resolves the canonical site origin (protocol + host, no trailing slash).
 *
 * Priority:
 *   1. NEXT_PUBLIC_SITE_URL
 *   2. NEXT_PUBLIC_VERCEL_URL, prefixed with "https://" when it lacks a protocol
 *   3. "http://localhost:3000"
 */
export function getSiteUrl(): string {
    const explicit = process.env.NEXT_PUBLIC_SITE_URL;
    if (explicit) {
        return stripTrailingSlashes(explicit);
    }

    const vercel = process.env.NEXT_PUBLIC_VERCEL_URL;
    if (vercel) {
        const withProtocol = /^https?:\/\//.test(vercel) ? vercel : `https://${vercel}`;
        return stripTrailingSlashes(withProtocol);
    }

    return "http://localhost:3000";
}

/**
 * Returns the host (no protocol, no trailing slash) for display in UI/cards.
 */
export function getSiteHost(): string {
    return getSiteUrl().replace(/^https?:\/\//, "");
}
