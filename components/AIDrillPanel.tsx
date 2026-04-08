"use client";

import { useEffect, useCallback } from "react";
import {
    Button,
    Badge,
    Text,
    Box,
    VStack,
    HStack,
    Flex,
    DialogRoot,
    DialogContent,
    DialogHeader,
    DialogBody,
    DialogFooter,
    DialogCloseTrigger,
    DialogTitle,
    type IconProps as ChakraIconProps,
    chakra,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import { useAIDrills } from "@/hooks/useAIDrills";
import { AILoadingSkeleton } from "@/components/AILoadingSkeleton";
import type { Snippet, SupportedLanguage } from "@/lib/snippets";
import { usePreferences } from "@/lib/preferences";

interface AIDrillPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onAccept: (snippet: Snippet) => void;
    language: SupportedLanguage;
}

const MotionBox = motion(Box);

function ZapIcon(props: ChakraIconProps) {
    return (
        <chakra.svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
            {...props}
        >
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </chakra.svg>
    );
}

export function AIDrillPanel({ isOpen, onClose, onAccept, language }: AIDrillPanelProps) {
    const { preferences } = usePreferences();
    const ai = useAIDrills(preferences);

    const handleAccept = useCallback(async () => {
        const snippet = await ai.acceptDrill();
        if (snippet) {
            onAccept(snippet);
            onClose();
        }
    }, [ai, onAccept, onClose]);

    const handleGenerateAnother = useCallback(() => {
        ai.generateDrill(language);
    }, [ai, language]);

    const handleRetry = useCallback(() => {
        ai.generateDrill(language);
    }, [ai, language]);

    // Generate drill on open
    useEffect(() => {
        if (isOpen && ai.state.status === "idle") {
            ai.generateDrill(language);
        }
    }, [isOpen, ai, language]);

    // Keyboard shortcuts
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (ai.state.status === "loading") return;

            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleAccept();
            } else if (e.key === "Enter" && e.shiftKey) {
                e.preventDefault();
                handleGenerateAnother();
            } else if (e.key === "Escape") {
                e.preventDefault();
                onClose();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, ai.state.status, handleAccept, handleGenerateAnother, onClose]);

    // Don't render on mobile (<640px)
    if (typeof window !== "undefined" && window.innerWidth < 640) {
        return null;
    }

    const isLoading = ai.state.status === "loading";
    const isPreview = ai.state.status === "preview";
    const isError = ai.state.status === "error";

    const drill = isPreview ? (ai.state as { status: "preview"; drill: { title: string; content: string; explanation: string; focusAreas: string[]; estimatedDifficulty: "easy" | "medium" | "hard"; }; costUsd: number; provider: "claude" | "openai" | "fireworks"; }).drill : null;
    const cost = isPreview ? (ai.state as { status: "preview"; costUsd: number; }).costUsd : 0;
    const provider = isPreview ? (ai.state as { status: "preview"; provider: "claude" | "openai" | "fireworks"; }).provider : null;

    const lineCount = drill ? drill.content.split("\n").length : 0;

    return (
        <DialogRoot
            open={isOpen}
            onOpenChange={(details: { open: boolean }) => !details.open && onClose()}
            size="lg"
            placement="center"
        >
            <DialogContent bg="var(--panel)" border="1px solid var(--border)">
                <DialogHeader borderBottom="1px solid var(--border)">
                    <DialogTitle>
                        <HStack gap={2} align="center">
                            <ZapIcon boxSize={5} color="var(--accent)" />
                            <Text fontSize="lg" fontWeight={600}>
                                AI Drill
                            </Text>
                            <Badge size="sm" colorScheme="accent" ml="auto">
                                {ai.remainingToday} remaining today
                            </Badge>
                        </HStack>
                    </DialogTitle>
                </DialogHeader>

                <DialogBody py={4}>
                    <VStack gap={4} align="stretch">
                        {/* Loading State */}
                        {isLoading && (
                            <Box
                                bg="var(--bg-muted)"
                                p={4}
                                borderRadius="md"
                                border="1px solid var(--border)"
                            >
                                <AILoadingSkeleton />
                            </Box>
                        )}

                        {/* Error State */}
                        {isError && (
                            <Box p={4} textAlign="center">
                                <Text color="red.500" mb={4}>
                                    {(ai.state as { status: "error"; error: string; }).error}
                                </Text>
                                <Button onClick={handleRetry} colorScheme="accent">
                                    Try Again
                                </Button>
                            </Box>
                        )}

                        {/* Preview State */}
                        {isPreview && drill && (
                            <MotionBox
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.3 }}
                            >
                                {/* Title */}
                                <Text fontSize="lg" fontWeight={600} mb={2}>
                                    {drill.title}
                                </Text>

                                {/* Explanation */}
                                <Text fontSize="sm" color="gray.500" mb={4}>
                                    {drill.explanation}
                                </Text>

                                {/* Code Preview */}
                                <Box
                                    bg="var(--bg-muted)"
                                    p={4}
                                    borderRadius="md"
                                    border="1px solid var(--border)"
                                    overflow="auto"
                                    maxH="50vh"
                                    mb={4}
                                >
                                    <Box
                                        as="pre"
                                        fontFamily="monospace"
                                        fontSize="14px"
                                        color="var(--text)"
                                        whiteSpace="pre"
                                        m={0}
                                    >
                                        {drill.content}
                                    </Box>
                                </Box>

                                {/* Focus Areas */}
                                {drill.focusAreas.length > 0 && (
                                    <Flex gap={2} flexWrap="wrap">
                                        {drill.focusAreas.map((area: string) => (
                                            <Badge key={area} size="sm" variant="subtle">
                                                {area}
                                            </Badge>
                                        ))}
                                    </Flex>
                                )}
                            </MotionBox>
                        )}
                    </VStack>
                </DialogBody>

                {/* Footer */}
                <DialogFooter borderTop="1px solid var(--border)">
                    <VStack width="100%" gap={3}>
                        {/* Metadata */}
                        {isPreview && drill && (
                            <HStack gap={4} fontSize="xs" color="gray.500" justify="center" width="100%">
                                <Badge size="sm" colorScheme={drill.estimatedDifficulty === "easy" ? "green" : drill.estimatedDifficulty === "medium" ? "yellow" : "red"}>
                                    {drill.estimatedDifficulty}
                                </Badge>
                                <Text>{lineCount} lines</Text>
                                <Text>~${cost.toFixed(3)}</Text>
                                <Text>{provider === "claude" ? "claude-haiku-4-5" : provider === "fireworks" ? "llama-v3p1-70b" : "gpt-4o-mini"}</Text>
                            </HStack>
                        )}

                        {/* Action Buttons */}
                        <HStack gap={2} justify="center" width="100%">
                            <Button
                                variant="ghost"
                                onClick={onClose}
                                disabled={isLoading}
                            >
                                Cancel (Esc)
                            </Button>
                            <Button
                                variant="outline"
                                onClick={handleGenerateAnother}
                                disabled={isLoading}
                            >
                                Generate Another (Shift+Enter)
                            </Button>
                            <Button
                                bg="var(--accent)"
                                color="var(--bg)"
                                _hover={{ bg: "var(--accent)", opacity: 0.9 }}
                                onClick={handleAccept}
                                disabled={isLoading || !isPreview}
                                loading={isLoading}
                            >
                                Use This Drill (Enter)
                            </Button>
                        </HStack>
                    </VStack>
                    <DialogCloseTrigger />
                </DialogFooter>
            </DialogContent>
        </DialogRoot>
    );
}

export default AIDrillPanel;
