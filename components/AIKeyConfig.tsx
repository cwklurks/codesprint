"use client";

import { useCallback, useEffect, useState } from "react";
import {
    Box,
    Button,
    Input,
    Text,
    Flex,
    Badge,
    SwitchControl,
    SwitchHiddenInput,
    SwitchRoot,
} from "@chakra-ui/react";
import { usePreferences } from "@/lib/preferences";
import { storeApiKey, clearApiKey, hasApiKey, getApiKey, type AIProvider } from "@/lib/ai/key-storage";

const PROVIDERS: ReadonlyArray<{ value: AIProvider; label: string; placeholder: string }> = [
    { value: "claude", label: "Claude API key", placeholder: "sk-ant-..." },
    { value: "openai", label: "OpenAI API key", placeholder: "sk-..." },
    { value: "fireworks", label: "Fireworks API key", placeholder: "fw-..." },
];

const NO_KEYS: Record<AIProvider, boolean> = { claude: false, openai: false, fireworks: false };

const inputProps = {
    size: "sm",
    bg: "var(--surface)",
    borderColor: "var(--border)",
    color: "var(--text)",
    borderRadius: "var(--radius-sm)",
    _placeholder: { color: "var(--text-subtle)" },
} as const;

type ProviderKeyRowProps = {
    provider: AIProvider;
    label: string;
    placeholder: string;
    hasKey: boolean;
    isActive: boolean;
    onSave: (provider: AIProvider, key: string) => void;
    onClear: (provider: AIProvider) => void;
    onUse: (provider: AIProvider) => void;
};

/** One provider's key: masked with clear/use once stored, an entry field before that. */
function ProviderKeyRow({
    provider,
    label,
    placeholder,
    hasKey,
    isActive,
    onSave,
    onClear,
    onUse,
}: ProviderKeyRowProps) {
    const [draft, setDraft] = useState("");

    const handleSave = () => {
        const trimmed = draft.trim();
        if (!trimmed) return;
        onSave(provider, trimmed);
        setDraft("");
    };

    return (
        <Box mb={4}>
            <Flex align="center" justify="space-between" mb={2}>
                <Text fontSize="sm" fontWeight={500} color="var(--text)">
                    {label}
                </Text>
                {hasKey && (
                    <Badge
                        size="sm"
                        bg="transparent"
                        border="1px solid"
                        borderColor={isActive ? "var(--success)" : "var(--border)"}
                        color={isActive ? "var(--success)" : "var(--text-subtle)"}
                        borderRadius="var(--radius-sm)"
                    >
                        {isActive ? "Active" : "Available"}
                    </Badge>
                )}
            </Flex>
            {hasKey ? (
                <Flex gap={2}>
                    <Input
                        {...inputProps}
                        aria-label={`${label} (saved)`}
                        type="password"
                        value="••••••••••••"
                        disabled
                        readOnly
                    />
                    <Button
                        size="sm"
                        variant="ghost"
                        color="var(--text-subtle)"
                        _hover={{ bg: "var(--surface-hover)", color: "var(--text)" }}
                        onClick={() => onClear(provider)}
                    >
                        Clear
                    </Button>
                    <Button
                        size="sm"
                        variant={isActive ? "solid" : "outline"}
                        borderColor="var(--border)"
                        borderRadius="var(--radius-sm)"
                        bg={isActive ? "var(--accent)" : "transparent"}
                        color={isActive ? "var(--bg)" : "var(--text)"}
                        _hover={isActive ? { opacity: 0.9 } : { bg: "var(--surface-hover)" }}
                        onClick={() => onUse(provider)}
                    >
                        Use
                    </Button>
                </Flex>
            ) : (
                <Flex gap={2}>
                    <Input
                        {...inputProps}
                        aria-label={label}
                        type="password"
                        placeholder={placeholder}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                    />
                    <Button
                        size="sm"
                        borderRadius="var(--radius-sm)"
                        bg="var(--accent)"
                        color="var(--bg)"
                        _hover={{ opacity: 0.9 }}
                        onClick={handleSave}
                        disabled={!draft.trim()}
                    >
                        Save
                    </Button>
                </Flex>
            )}
        </Box>
    );
}

export function AIKeyConfig() {
    const {
        preferences,
        setAIDrillsEnabled,
        setAIProvider,
        setAIMaxDrillsPerDay,
    } = usePreferences();

    // Keys live in localStorage, outside React. Snapshot their presence into
    // state so saving or clearing one actually repaints the row.
    const [presentKeys, setPresentKeys] = useState<Record<AIProvider, boolean>>(NO_KEYS);
    const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
    const [testError, setTestError] = useState<string | null>(null);

    const refreshKeys = useCallback(() => {
        setPresentKeys({
            claude: hasApiKey("claude"),
            openai: hasApiKey("openai"),
            fireworks: hasApiKey("fireworks"),
        });
    }, []);

    useEffect(() => {
        refreshKeys();
    }, [refreshKeys]);

    const activeProvider = preferences.aiProvider;
    const hasAnyKey = presentKeys.claude || presentKeys.openai || presentKeys.fireworks;

    const handleSave = useCallback((provider: AIProvider, key: string) => {
        storeApiKey(provider, key);
        refreshKeys();
        setTestStatus("idle");
        setTestError(null);
    }, [refreshKeys]);

    const handleClear = useCallback((provider: AIProvider) => {
        clearApiKey(provider);
        refreshKeys();
        setTestStatus("idle");
        setTestError(null);
    }, [refreshKeys]);

    const handleTest = useCallback(async () => {
        setTestStatus("testing");
        setTestError(null);

        const apiKey = getApiKey(activeProvider);
        if (!apiKey) {
            setTestStatus("error");
            setTestError("No API key configured");
            return;
        }

        try {
            const response = await fetch("/api/generate", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    language: "python",
                    difficulty: "easy",
                    lengthCategory: "short",
                    weakPatterns: [],
                    targetTokenCategories: [],
                    recentDrillTitles: [],
                    userContext: {
                        estimatedWpm: 40,
                        estimatedAccuracy: 0.85,
                        sessionCount: 0,
                    },
                }),
            });

            if (response.ok) {
                setTestStatus("success");
            } else {
                const error = await response.json();
                setTestStatus("error");
                setTestError(error.error || "Connection failed");
            }
        } catch (error) {
            setTestStatus("error");
            setTestError(error instanceof Error ? error.message : "Connection failed");
        }
    }, [activeProvider]);

    return (
        <Box>
            <Box
                mb={4}
                p={3}
                borderRadius="var(--radius-md)"
                bg="var(--surface)"
                border="1px solid var(--border)"
            >
                <Flex gap={3}>
                    <Box color="var(--accent)" mt={0.5} flexShrink={0}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M12 16v-4"/>
                            <path d="M12 8h.01"/>
                        </svg>
                    </Box>
                    <Box>
                        <Text fontSize="sm" fontWeight={600} color="var(--text)">
                            Bring your own key
                        </Text>
                        <Text fontSize="sm" color="var(--text-subtle)" mt={1}>
                            Your API key is stored locally in your browser. It is sent to our server
                            per-request to proxy the AI call, but is never stored or logged.
                        </Text>
                    </Box>
                </Flex>
            </Box>

            {PROVIDERS.map((provider) => (
                <ProviderKeyRow
                    key={provider.value}
                    provider={provider.value}
                    label={provider.label}
                    placeholder={provider.placeholder}
                    hasKey={presentKeys[provider.value]}
                    isActive={activeProvider === provider.value}
                    onSave={handleSave}
                    onClear={handleClear}
                    onUse={setAIProvider}
                />
            ))}

            {/* Test Connection */}
            <Flex gap={2} mb={4} align="center">
                <Button
                    size="sm"
                    variant="outline"
                    borderColor="var(--border)"
                    borderRadius="var(--radius-sm)"
                    color="var(--text)"
                    _hover={{ bg: "var(--surface-hover)" }}
                    onClick={handleTest}
                    loading={testStatus === "testing"}
                    disabled={!hasAnyKey}
                >
                    Test connection
                </Button>
                {testStatus === "success" && (
                    <Badge
                        size="sm"
                        bg="transparent"
                        border="1px solid var(--success)"
                        color="var(--success)"
                        borderRadius="var(--radius-sm)"
                    >
                        Connected
                    </Badge>
                )}
                {testStatus === "error" && (
                    <Badge
                        size="sm"
                        bg="transparent"
                        border="1px solid var(--error)"
                        color="var(--error)"
                        borderRadius="var(--radius-sm)"
                    >
                        Failed
                    </Badge>
                )}
            </Flex>
            {testStatus === "error" && testError && (
                <Text fontSize="xs" color="var(--error)" mb={4} aria-live="polite">
                    {testError}
                </Text>
            )}

            {/* Daily Limit */}
            <Flex align="center" justify="space-between" mb={4} gap={4}>
                <Text fontSize="sm" color="var(--text)">Daily limit</Text>
                <Flex gap={2} align="center">
                    <Input
                        {...inputProps}
                        aria-label="Daily drill limit"
                        type="number"
                        value={preferences.aiMaxDrillsPerDay}
                        onChange={(e) => setAIMaxDrillsPerDay(parseInt(e.target.value, 10) || 20)}
                        width="80px"
                        min={1}
                        max={1000}
                    />
                    <Text fontSize="sm" color="var(--text-subtle)">drills/day</Text>
                </Flex>
            </Flex>

            {/* Enable/Disable. A switch, like every other boolean in preferences --
                this used to be the one setting that spoke in On/Off pills. */}
            <Flex align="center" justify="space-between" gap={4}>
                <Text fontSize="sm" color="var(--text)">Enable AI drills</Text>
                <SwitchRoot
                    checked={preferences.aiDrillsEnabled}
                    disabled={!hasAnyKey}
                    onCheckedChange={({ checked }) => setAIDrillsEnabled(checked)}
                    display="inline-flex"
                    alignItems="center"
                    flexShrink={0}
                >
                    <SwitchControl />
                    <SwitchHiddenInput aria-label="Enable AI drills" />
                </SwitchRoot>
            </Flex>
        </Box>
    );
}
