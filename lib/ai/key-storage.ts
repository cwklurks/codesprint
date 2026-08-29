/**
 * API Key Storage
 * BYOK (Bring Your Own Key) model - store keys in localStorage
 */

const KEY_PREFIX = "codesprint-ai-key-";

export type AIProvider = "claude" | "openai" | "fireworks";

/**
 * localStorage throws outright in Safari private browsing and whenever site
 * data is blocked. AI drills are optional, so every access degrades to "no key
 * configured" rather than taking the render down with it.
 */
function readKey(provider: AIProvider): string | null {
    if (typeof window === "undefined") return null;
    try {
        return localStorage.getItem(`${KEY_PREFIX}${provider}`);
    } catch {
        return null;
    }
}

/**
 * Store an API key for a provider
 */
export function storeApiKey(provider: AIProvider, key: string): void {
    if (typeof window === "undefined") return;
    try {
        localStorage.setItem(`${KEY_PREFIX}${provider}`, key);
    } catch {
        // Storage unavailable: the key stays in memory for this page only.
    }
}

/**
 * Get the stored API key for a provider
 */
export function getApiKey(provider: AIProvider): string | null {
    return readKey(provider);
}

/**
 * Clear the stored API key for a provider
 */
export function clearApiKey(provider: AIProvider): void {
    if (typeof window === "undefined") return;
    try {
        localStorage.removeItem(`${KEY_PREFIX}${provider}`);
    } catch {
        // Nothing was persisted, so there is nothing to clear.
    }
}

/**
 * Check if an API key exists for a provider
 */
export function hasApiKey(provider: AIProvider): boolean {
    return readKey(provider) !== null;
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
