"use client";

import { Box, Flex, Grid, Text } from "@chakra-ui/react";
import { THEME_OPTIONS, THEME_PRESETS, usePreferences } from "@/lib/preferences";

export function ThemeSelector() {
    const { preferences, setTheme } = usePreferences();

    return (
        <Grid templateColumns="repeat(auto-fill, minmax(140px, 1fr))" gap={3}>
            {THEME_OPTIONS.map((option) => {
                const theme = THEME_PRESETS[option.value];
                const isActive = preferences.theme === option.value;

                return (
                    <Box
                        key={option.value}
                        as="button"
                        onClick={() => setTheme(option.value)}
                        w="100%"
                        px={3}
                        py={2}
                        borderRadius="md"
                        bg={theme.bg}
                        color={theme.text}
                        fontSize="xs"
                        fontWeight="medium"
                        textAlign="center"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        gap={2}
                        position="relative"
                        transition="transform 0.1s"
                        _hover={{ transform: "translateY(-1px)" }}
                        _active={{ transform: "translateY(0)" }}
                        outline={isActive ? "2px solid" : "none"}
                        outlineColor="var(--accent)"
                        outlineOffset={2}
                    >
                        <Text as="span" whiteSpace="nowrap">{option.label}</Text>
                        <Flex gap="2px">
                            <Box w="6px" h="6px" borderRadius="full" bg={theme.accent} />
                            <Box w="6px" h="6px" borderRadius="full" bg={theme.textSubtle} />
                            <Box w="6px" h="6px" borderRadius="full" bg={theme.bgMuted} />
                        </Flex>
                    </Box>
                );
            })}
        </Grid>
    );
}

