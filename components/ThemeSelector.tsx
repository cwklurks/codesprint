"use client";

import { Box, Flex, Grid, Text } from "@chakra-ui/react";
import { THEME_OPTIONS, THEME_PRESETS } from "@/lib/preferences-core";
import { usePreferences } from "@/lib/preferences";

/**
 * Every swatch renders a miniature of the thing the theme is actually for: a
 * line of code mid-run. Keyword sits on `accent`, typed text on `text`, the
 * mistyped character on `error`, the caret on `caret`, and the read-ahead on
 * `textSubtle` -- the five colors that decide whether a theme is usable.
 */
const PREVIEW = {
    keyword: "let",
    typed: " ok",
    wrong: "e",
    ahead: " = 1",
} as const;

export function ThemeSelector() {
    const { preferences, setTheme } = usePreferences();

    return (
        <Grid templateColumns="repeat(auto-fill, minmax(148px, 1fr))" gap={2.5}>
            {THEME_OPTIONS.map((option) => {
                const theme = THEME_PRESETS[option.value];
                const isActive = preferences.theme === option.value;

                return (
                    <Box
                        key={option.value}
                        as="button"
                        aria-pressed={isActive}
                        onClick={() => setTheme(option.value)}
                        w="100%"
                        px={2.5}
                        py={2}
                        textAlign="left"
                        borderRadius="var(--radius-sm)"
                        bg={theme.bg}
                        border="1px solid"
                        borderColor={isActive ? theme.accent : theme.border}
                        boxShadow={isActive ? "0 0 0 2px var(--accent), var(--elev-2)" : "var(--elev-1)"}
                        transition="background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, transform 0.12s ease"
                        _hover={{ transform: "translateY(-1px)", borderColor: theme.accent }}
                        _active={{ transform: "translateY(0)" }}
                    >
                        <Flex align="center" justify="space-between" gap={2}>
                            <Text
                                as="span"
                                fontSize="xs"
                                fontWeight={600}
                                color={theme.text}
                                whiteSpace="nowrap"
                                overflow="hidden"
                                textOverflow="ellipsis"
                            >
                                {option.label}
                            </Text>
                            <Box
                                as="span"
                                flexShrink={0}
                                w="7px"
                                h="7px"
                                borderRadius="full"
                                bg={theme.accent}
                            />
                        </Flex>

                        <Flex
                            aria-hidden="true"
                            mt={1.5}
                            align="center"
                            fontFamily="var(--font-mono), ui-monospace, monospace"
                            fontSize="10px"
                            lineHeight="14px"
                            whiteSpace="pre"
                            borderRadius="4px"
                            bg={theme.bgMuted}
                            px={1.5}
                            py={1}
                        >
                            <Box as="span" color={theme.accent}>
                                {PREVIEW.keyword}
                            </Box>
                            <Box as="span" color={theme.text}>
                                {PREVIEW.typed}
                            </Box>
                            <Box
                                as="span"
                                color={theme.error}
                                textDecoration="underline"
                                textDecorationColor={theme.error}
                            >
                                {PREVIEW.wrong}
                            </Box>
                            <Box
                                as="span"
                                display="inline-block"
                                w="2px"
                                h="11px"
                                mx="1px"
                                borderRadius="999px"
                                bg={theme.caret}
                            />
                            <Box as="span" color={theme.textSubtle}>
                                {PREVIEW.ahead}
                            </Box>
                        </Flex>
                    </Box>
                );
            })}
        </Grid>
    );
}
