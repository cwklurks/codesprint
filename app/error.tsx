"use client";

import { useEffect } from "react";
import { Box, Button, Text, VStack } from "@chakra-ui/react";

/**
 * Route-level error boundary. Renders inside the providers, so the active theme
 * variables still apply and the page keeps the app's chrome.
 */
export default function RouteError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("Route error:", error);
    }, [error]);

    return (
        <Box
            display="flex"
            alignItems="center"
            justifyContent="center"
            minH="60vh"
            p={8}
            w="100%"
        >
            <VStack
                gap={4}
                align="center"
                maxW="480px"
                textAlign="center"
                borderRadius="var(--radius-lg)"
                border="1px solid var(--border)"
                bg="var(--panel-soft)"
                px={8}
                py={10}
                boxShadow="var(--elev-2)"
            >
                <Text
                    fontSize="xs"
                    letterSpacing="0.08em"
                    textTransform="uppercase"
                    color="var(--text-subtle)"
                >
                    Something broke
                </Text>
                <Text fontSize="xl" fontWeight={700} color="var(--text)">
                    This run hit an error
                </Text>
                <Text fontSize="sm" color="var(--text-subtle)">
                    Your session history is stored locally and is untouched. Try again, or reload
                    if it keeps happening.
                </Text>
                {error.digest ? (
                    <Text fontSize="xs" color="var(--text-subtle)" fontFamily="var(--font-mono)">
                        {error.digest}
                    </Text>
                ) : null}
                <Button
                    onClick={reset}
                    bg="var(--accent)"
                    color="var(--bg)"
                    fontWeight={600}
                    borderRadius="var(--radius-sm)"
                    _hover={{ opacity: 0.9 }}
                >
                    Try again
                </Button>
            </VStack>
        </Box>
    );
}
