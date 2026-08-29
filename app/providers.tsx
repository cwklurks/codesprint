"use client";

import { ChakraProvider } from "@chakra-ui/react";
import { ReactNode } from "react";
import EmotionCacheProvider from "@/components/EmotionCacheProvider";
import { chakraSystem } from "@/lib/chakra-system";

export function AppProviders({ children }: { children: ReactNode }) {
    return (
        <EmotionCacheProvider>
            <ChakraProvider value={chakraSystem}>{children}</ChakraProvider>
        </EmotionCacheProvider>
    );
}
