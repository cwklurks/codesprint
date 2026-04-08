"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { Box, Text, Button, VStack } from "@chakra-ui/react";

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * Error Boundary for graceful error handling in React components.
 * Catches errors during rendering and provides a fallback UI.
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        // Log to console for debugging
        console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    private handleReset = (): void => {
        window.location.reload();
    };

    render(): ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <Box
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    minH="50vh"
                    p={8}
                >
                    <VStack gap={4} align="center">
                        <Text fontSize="xl" fontWeight="semibold" color="red.500">
                            Something went wrong
                        </Text>
                        <Text color="fg.muted" textAlign="center" fontSize="sm">
                            An error occurred in this component. Please try reloading.
                        </Text>
                        <Button onClick={this.handleReset} colorPalette="red">
                            Reload Page
                        </Button>
                    </VStack>
                </Box>
            );
        }

        return this.props.children;
    }
}
