"use client";

import { Box, Flex, Text } from "@chakra-ui/react";
import { THEME_OPTIONS, THEME_PRESETS, usePreferences } from "@/lib/preferences";

export function ThemeIndicator() {
    const { preferences } = usePreferences();
    const theme = THEME_PRESETS[preferences.theme];
    const themeOption = THEME_OPTIONS.find((o) => o.value === preferences.theme);

    if (!theme || !themeOption) return null;

    return (
        <Flex
            align="center"
            gap={2}
            px={3}
            py={1.5}
            bg="rgba(255, 255, 255, 0.06)"
            borderRadius="full"
            border="1px solid var(--header-border)"
            transition="all 0.2s"
            _hover={{
                borderColor: "var(--header-text)",
                bg: "var(--surface)",
            }}
        >
            <Box
                w="8px"
                h="8px"
                borderRadius="full"
                bg={theme.accent}
                boxShadow={`0 0 6px ${theme.accent}`}
            />
            <Text fontSize="xs" color="var(--header-text)" fontWeight="medium">
                {themeOption.label}
            </Text>
        </Flex>
    );
}

