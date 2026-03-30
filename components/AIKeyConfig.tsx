"use client";

import { useState, useCallback } from "react";
import {
    Box,
    Button,
    Input,
    Text,
    Flex,
    Badge,
    Alert,
} from "@chakra-ui/react";
import { usePreferences } from "@/lib/preferences";
import { storeApiKey, clearApiKey, hasApiKey, getApiKey, type AIProvider } from "@/lib/ai/key-storage";

export function AIKeyConfig() {
    const {
        preferences,
        setAIDrillsEnabled,
        setAIProvider,
        setAIMaxDrillsPerDay,
    } = usePreferences();

    const [claudeKey, setClaudeKey] = useState("");
    const [openaiKey, setOpenaiKey] = useState("");
    const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
    const [testError, setTestError] = useState<string | null>(null);

    const hasClaudeKey = hasApiKey("claude");
    const hasOpenaiKey = hasApiKey("openai");
    const activeProvider = preferences.aiProvider;

    const handleSaveClaude = useCallback(() => {
        if (claudeKey.trim()) {
            storeApiKey("claude", claudeKey.trim());
            setClaudeKey("");
            setTestStatus("idle");
        }
    }, [claudeKey]);

    const handleSaveOpenai = useCallback(() => {
        if (openaiKey.trim()) {
            storeApiKey("openai", openaiKey.trim());
            setOpenaiKey("");
            setTestStatus("idle");
        }
    }, [openaiKey]);

    const handleClear = useCallback((provider: AIProvider) => {
        clearApiKey(provider);
        setTestStatus("idle");
    }, []);

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
            <Flex align="center" justify="space-between" mb={3}>
                <Text fontSize="sm" fontWeight={600}>
                    AI Drills
                </Text>
                <Badge colorScheme={preferences.aiDrillsEnabled ? "green" : "gray"}>
                    {preferences.aiDrillsEnabled ? "Enabled" : "Disabled"}
                </Badge>
            </Flex>

            <Alert.Root status="info" mb={4} size="sm">
                <Alert.Indicator />
                <Alert.Content>
                    <Alert.Title>Bring Your Own Key</Alert.Title>
                    <Alert.Description>
                        Your API key is stored locally in your browser. It is sent to our server
                        per-request to proxy the AI call, but is never stored or logged.
                    </Alert.Description>
                </Alert.Content>
            </Alert.Root>

            {/* Claude */}
            <Box mb={4}>
                <Flex align="center" justify="space-between" mb={2}>
                    <Text fontSize="sm" fontWeight={500}>Claude API Key</Text>
                    <Flex gap={2}>
                        {hasClaudeKey && (
                            <Badge size="sm" colorScheme="green">
                                {activeProvider === "claude" ? "Active" : "Available"}
                            </Badge>
                        )}
                    </Flex>
                </Flex>
                {hasClaudeKey ? (
                    <Flex gap={2}>
                        <Input
                            type="password"
                            value="••••••••••••"
                            disabled
                            size="sm"
                        />
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleClear("claude")}
                        >
                            Clear
                        </Button>
                        <Button
                            size="sm"
                            variant={activeProvider === "claude" ? "solid" : "outline"}
                            onClick={() => setAIProvider("claude")}
                        >
                            Use
                        </Button>
                    </Flex>
                ) : (
                    <Flex gap={2}>
                        <Input
                            type="password"
                            placeholder="sk-ant-..."
                            value={claudeKey}
                            onChange={(e) => setClaudeKey(e.target.value)}
                            size="sm"
                        />
                        <Button
                            size="sm"
                            onClick={handleSaveClaude}
                            disabled={!claudeKey.trim()}
                        >
                            Save
                        </Button>
                    </Flex>
                )}
            </Box>

            {/* OpenAI */}
            <Box mb={4}>
                <Flex align="center" justify="space-between" mb={2}>
                    <Text fontSize="sm" fontWeight={500}>OpenAI API Key</Text>
                    <Flex gap={2}>
                        {hasOpenaiKey && (
                            <Badge size="sm" colorScheme="green">
                                {activeProvider === "openai" ? "Active" : "Available"}
                            </Badge>
                        )}
                    </Flex>
                </Flex>
                {hasOpenaiKey ? (
                    <Flex gap={2}>
                        <Input
                            type="password"
                            value="••••••••••••"
                            disabled
                            size="sm"
                        />
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleClear("openai")}
                        >
                            Clear
                        </Button>
                        <Button
                            size="sm"
                            variant={activeProvider === "openai" ? "solid" : "outline"}
                            onClick={() => setAIProvider("openai")}
                        >
                            Use
                        </Button>
                    </Flex>
                ) : (
                    <Flex gap={2}>
                        <Input
                            type="password"
                            placeholder="sk-..."
                            value={openaiKey}
                            onChange={(e) => setOpenaiKey(e.target.value)}
                            size="sm"
                        />
                        <Button
                            size="sm"
                            onClick={handleSaveOpenai}
                            disabled={!openaiKey.trim()}
                        >
                            Save
                        </Button>
                    </Flex>
                )}
            </Box>

            {/* Test Connection */}
            <Flex gap={2} mb={4} align="center">
                <Button
                    size="sm"
                    variant="outline"
                    onClick={handleTest}
                    loading={testStatus === "testing"}
                    disabled={!hasClaudeKey && !hasOpenaiKey}
                >
                    Test Connection
                </Button>
                {testStatus === "success" && (
                    <Badge colorScheme="green" size="sm">Connected</Badge>
                )}
                {testStatus === "error" && (
                    <Badge colorScheme="red" size="sm">Failed</Badge>
                )}
            </Flex>
            {testStatus === "error" && testError && (
                <Text fontSize="xs" color="red.500" mb={4}>
                    {testError}
                </Text>
            )}

            {/* Daily Limit */}
            <Flex align="center" justify="space-between" mb={4}>
                <Text fontSize="sm">Daily Limit</Text>
                <Flex gap={2} align="center">
                    <Input
                        type="number"
                        value={preferences.aiMaxDrillsPerDay}
                        onChange={(e) => setAIMaxDrillsPerDay(parseInt(e.target.value, 10) || 20)}
                        size="sm"
                        width="80px"
                        min={1}
                        max={1000}
                    />
                    <Text fontSize="sm" color="gray.500">drills/day</Text>
                </Flex>
            </Flex>

            {/* Enable/Disable */}
            <Flex align="center" justify="space-between">
                <Text fontSize="sm">Enable AI Drills</Text>
                <Button
                    size="sm"
                    variant={preferences.aiDrillsEnabled ? "solid" : "outline"}
                    onClick={() => setAIDrillsEnabled(!preferences.aiDrillsEnabled)}
                    disabled={!hasClaudeKey && !hasOpenaiKey}
                >
                    {preferences.aiDrillsEnabled ? "On" : "Off"}
                </Button>
            </Flex>
        </Box>
    );
}
