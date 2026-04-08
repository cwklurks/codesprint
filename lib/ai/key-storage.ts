/**
 * API Key Storage
 * BYOK (Bring Your Own Key) model - store keys in localStorage
 */

const KEY_PREFIX = "codesprint-ai-key-";

export type AIProvider = "claude" | "openai" | "fireworks";

/**
 * Store an API key for a provider
 */
export function storeApiKey(provider: AIProvider, key: string): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(`${KEY_PREFIX}${provider}`, key);
}

/**
 * Get the stored API key for a provider
 */
export function getApiKey(provider: AIProvider): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(`${KEY_PREFIX}${provider}`);
}

/**
 * Clear the stored API key for a provider
 */
export function clearApiKey(provider: AIProvider): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(`${KEY_PREFIX}${provider}`);
}

/**
 * Check if an API key exists for a provider
 */
export function hasApiKey(provider: AIProvider): boolean {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(`${KEY_PREFIX}${provider}`) !== null;
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
