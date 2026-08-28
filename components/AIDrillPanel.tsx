"use client";

import { useEffect, useCallback, useState } from "react";
import {
    Button,
    Badge,
    Text,
    Box,
    VStack,
    HStack,
    Flex,
    DialogBackdrop,
    DialogRoot,
    DialogContent,
    DialogHeader,
    DialogBody,
    DialogFooter,
    DialogPositioner,
    DialogTitle,
    Portal,
    type IconProps as ChakraIconProps,
    chakra,
} from "@chakra-ui/react";
import { m } from "framer-motion";
import { useAIDrills } from "@/hooks/useAIDrills";
import { AILoadingSkeleton } from "@/components/AILoadingSkeleton";
import type { Snippet, SupportedLanguage } from "@/lib/snippets";
import { usePreferences } from "@/lib/preferences";
import { MOTION_DURATION, usePrefersReducedMotion } from "@/lib/motion";
import { DialogCloseButton } from "@/components/ui/DialogCloseButton";
import {
    overlayBackdropProps,
    overlayDialogProps,
    overlayFooterProps,
    overlayHeaderProps,
} from "@/components/ui/overlay";

interface AIDrillPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onAccept: (snippet: Snippet) => void | Promise<void>;
    language: SupportedLanguage;
}

const MotionBox = m.create(Box);

/** The dialog needs the room a code preview takes; below this it is not offered. */
const NARROW_VIEWPORT = "(max-width: 639px)";

const DIFFICULTY_COLOR: Record<"easy" | "medium" | "hard", string> = {
    easy: "var(--success)",
    medium: "var(--warning)",
    hard: "var(--error)",
};

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
    const reducedMotion = usePrefersReducedMotion();
    // Measured after mount: reading window.innerWidth during render desyncs SSR markup.
    const [isNarrowViewport, setIsNarrowViewport] = useState(false);

    const handleAccept = useCallback(async () => {
        const snippet = await ai.acceptDrill();
        if (snippet) {
            await onAccept(snippet);
            onClose();
        }
    }, [ai, onAccept, onClose]);

    const handleGenerateAnother = useCallback(() => {
        ai.generateDrill(language);
    }, [ai, language]);

    const handleRetry = useCallback(() => {
        ai.generateDrill(language);
    }, [ai, language]);

    useEffect(() => {
        const query = window.matchMedia(NARROW_VIEWPORT);
        const sync = () => setIsNarrowViewport(query.matches);
        sync();
        query.addEventListener("change", sync);
        return () => query.removeEventListener("change", sync);
    }, []);

    // Generate drill on open
    useEffect(() => {
        if (isOpen && ai.state.status === "idle") {
            ai.generateDrill(language);
        }
    }, [isOpen, ai, language]);

    // Accept / regenerate from the keyboard. Chakra maps neither Enter nor
    // Shift+Enter; Escape it does handle, so there is no listener for it here.
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
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, ai.state.status, handleAccept, handleGenerateAnother]);

    if (isNarrowViewport) {
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
            <Portal>
                <DialogBackdrop {...overlayBackdropProps} />
                <DialogPositioner>
                    <DialogContent {...overlayDialogProps}>
                        <DialogCloseButton />
                        <DialogHeader {...overlayHeaderProps}>
                            <HStack gap={2} align="center" width="100%" pr={8}>
                                <ZapIcon boxSize={5} color="var(--accent)" />
                                <DialogTitle fontSize="lg" fontWeight={600}>
                                    AI drill
                                </DialogTitle>
                                <Badge
                                    size="sm"
                                    bg="var(--surface)"
                                    color="var(--text-subtle)"
                                    border="1px solid var(--border)"
                                    borderRadius="var(--radius-sm)"
                                    ml="auto"
                                >
                                    {ai.remainingToday} remaining today
                                </Badge>
                            </HStack>
                        </DialogHeader>

                        <DialogBody py={4}>
                            <VStack gap={4} align="stretch">
                                {/* Loading State */}
                                {isLoading && (
                                    <Box
                                        bg="var(--surface)"
                                        p={4}
                                        borderRadius="var(--radius-md)"
                                        border="1px solid var(--border)"
                                    >
                                        <AILoadingSkeleton />
                                    </Box>
                                )}

                                {/* Error State */}
                                {isError && (
                                    <Box p={4} textAlign="center">
                                        <Text color="var(--error)" mb={4}>
                                            {(ai.state as { status: "error"; error: string; }).error}
                                        </Text>
                                        <Button
                                            onClick={handleRetry}
                                            bg="var(--accent)"
                                            color="var(--bg)"
                                            borderRadius="var(--radius-sm)"
                                            _hover={{ bg: "var(--accent)", opacity: 0.9 }}
                                        >
                                            Try again
                                        </Button>
                                    </Box>
                                )}

                                {/* Preview State */}
                                {isPreview && drill && (
                                    <MotionBox
                                        initial={reducedMotion ? false : { opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: reducedMotion ? 0 : MOTION_DURATION.base }}
                                    >
                                        {/* Title */}
                                        <Text fontSize="lg" fontWeight={600} mb={2} color="var(--text)">
                                            {drill.title}
                                        </Text>

                                        {/* Explanation */}
                                        <Text fontSize="sm" color="var(--text-subtle)" mb={4}>
                                            {drill.explanation}
                                        </Text>

                                        {/* Code Preview */}
                                        <Box
                                            bg="var(--surface)"
                                            p={4}
                                            borderRadius="var(--radius-md)"
                                            border="1px solid var(--border)"
                                            overflow="auto"
                                            maxH="50vh"
                                            mb={4}
                                        >
                                            <Box
                                                as="pre"
                                                fontFamily="var(--font-mono), ui-monospace, monospace"
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
                                                    <Badge
                                                        key={area}
                                                        size="sm"
                                                        variant="subtle"
                                                        bg="var(--surface)"
                                                        color="var(--text-subtle)"
                                                        borderRadius="var(--radius-sm)"
                                                    >
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
                        <DialogFooter {...overlayFooterProps}>
                            <VStack width="100%" gap={3}>
                                {/* Metadata */}
                                {isPreview && drill && (
                                    <HStack
                                        gap={4}
                                        fontSize="xs"
                                        color="var(--text-subtle)"
                                        justify="center"
                                        width="100%"
                                    >
                                        <Badge
                                            size="sm"
                                            bg="transparent"
                                            border="1px solid"
                                            borderColor={DIFFICULTY_COLOR[drill.estimatedDifficulty]}
                                            color={DIFFICULTY_COLOR[drill.estimatedDifficulty]}
                                            borderRadius="var(--radius-sm)"
                                        >
                                            {drill.estimatedDifficulty}
                                        </Badge>
                                        <Text fontVariantNumeric="tabular-nums">{lineCount} lines</Text>
                                        <Text fontVariantNumeric="tabular-nums">~${cost.toFixed(3)}</Text>
                                        <Text>{provider === "claude" ? "claude-haiku-4-5" : provider === "fireworks" ? "llama-v3p1-70b" : "gpt-4o-mini"}</Text>
                                    </HStack>
                                )}

                                {/* Action Buttons */}
                                <HStack gap={2} justify="center" width="100%">
                                    <Button
                                        variant="ghost"
                                        color="var(--text-subtle)"
                                        _hover={{ bg: "var(--surface-hover)", color: "var(--text)" }}
                                        onClick={onClose}
                                        disabled={isLoading}
                                    >
                                        Cancel (Esc)
                                    </Button>
                                    <Button
                                        variant="outline"
                                        borderColor="var(--border)"
                                        borderRadius="var(--radius-sm)"
                                        color="var(--text)"
                                        _hover={{ bg: "var(--surface-hover)" }}
                                        onClick={handleGenerateAnother}
                                        disabled={isLoading}
                                    >
                                        Generate another (Shift+Enter)
                                    </Button>
                                    <Button
                                        bg="var(--accent)"
                                        color="var(--bg)"
                                        borderRadius="var(--radius-sm)"
                                        _hover={{ bg: "var(--accent)", opacity: 0.9 }}
                                        onClick={handleAccept}
                                        disabled={isLoading || !isPreview}
                                        loading={isLoading}
                                    >
                                        Use this drill (Enter)
                                    </Button>
                                </HStack>
                            </VStack>
                        </DialogFooter>
                    </DialogContent>
                </DialogPositioner>
            </Portal>
        </DialogRoot>
    );
}

export default AIDrillPanel;
