"use client";

import { Flex, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

type EmptyStateProps = {
    /** Short statement of what is missing. */
    title: string;
    /** One line telling the reader how to fill it. */
    hint?: string;
    /** Inline SVG glyph; falls back to a neutral placeholder mark. */
    glyph?: ReactNode;
};

function DefaultGlyph() {
    return (
        <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
        >
            <rect x="3" y="4" width="18" height="16" rx="3" strokeDasharray="3 3" />
            <path d="M8 12h8" />
        </svg>
    );
}

/** The one empty-state treatment shared by every overlay. */
export function EmptyState({ title, hint, glyph }: EmptyStateProps) {
    return (
        <Flex direction="column" align="center" justify="center" gap={3} py={12} px={6} textAlign="center">
            <Flex
                align="center"
                justify="center"
                w="44px"
                h="44px"
                borderRadius="var(--radius-md)"
                border="1px solid var(--border)"
                bg="var(--surface)"
                color="var(--text-subtle)"
            >
                {glyph ?? <DefaultGlyph />}
            </Flex>
            <Text fontSize="sm" fontWeight={600} color="var(--text)">
                {title}
            </Text>
            {hint && (
                <Text fontSize="xs" color="var(--text-subtle)" maxW="36ch">
                    {hint}
                </Text>
            )}
        </Flex>
    );
}
