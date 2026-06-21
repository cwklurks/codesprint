/**
 * API Key Storage
 * BYOK (Bring Your Own Key) model - store keys in sessionStorage
 *
 * Keys are kept in sessionStorage so they expire when the tab closes,
 * reducing exposure to XSS or browser-extension access. They are never
 * persisted to disk and never leave the browser except as a per-request
 * Authorization header to this app's /api/generate route.
 */

const KEY_PREFIX = "codesprint-ai-key-";

export type AIProvider = "claude" | "openai" | "fireworks";

function storage(): Storage | null {
    if (typeof window === "undefined") return null;
    try {
        return window.sessionStorage;
    } catch {
        return null;
    }
}

/**
 * Store an API key for a provider
 */
export function storeApiKey(provider: AIProvider, key: string): void {
    const s = storage();
    if (!s) return;
    s.setItem(`${KEY_PREFIX}${provider}`, key);
}

/**
 * Get the stored API key for a provider
 */
export function getApiKey(provider: AIProvider): string | null {
    const s = storage();
    if (!s) return null;
    return s.getItem(`${KEY_PREFIX}${provider}`);
}

/**
 * Clear the stored API key for a provider
 */
export function clearApiKey(provider: AIProvider): void {
    const s = storage();
    if (!s) return;
    s.removeItem(`${KEY_PREFIX}${provider}`);
}

/**
 * Check if an API key exists for a provider
 */
export function hasApiKey(provider: AIProvider): boolean {
    const s = storage();
    if (!s) return false;
    return s.getItem(`${KEY_PREFIX}${provider}`) !== null;
}

/**
 * Get the active provider based on which key is available
 * Prefers Claude, then OpenAI, then Fireworks
 */
export function getActiveProvider(): AIProvider | null {
    if (hasApiKey("claude")) return "claude";
    if (hasApiKey("openai")) return "openai";
    if (hasApiKey("fireworks")) return "fireworks";
    return null;
}

/**
 * Get the API key for the active provider
 */
export function getActiveApiKey(): string | null {
    const provider = getActiveProvider();
    if (!provider) return null;
    return getApiKey(provider);
}

/**
 * Detect provider from API key prefix
 */
export function detectProviderFromKey(key: string): AIProvider | null {
    if (key.startsWith("sk-ant-")) return "claude";
    if (key.startsWith("fw-")) return "fireworks";
    if (key.startsWith("sk-") || key.startsWith("sk-proj-")) return "openai";
    return null;
}
