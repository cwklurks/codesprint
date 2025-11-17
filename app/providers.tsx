"use client";

import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { ReactNode } from "react";
import EmotionCacheProvider from "@/components/EmotionCacheProvider";

export function AppProviders({ children }: { children: ReactNode }) {
    return (
        <EmotionCacheProvider>
            <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
        </EmotionCacheProvider>
    );
}
