"use client";

import {
    Box,
    Button,
    CloseButton,
    DrawerBackdrop,
    DrawerBody,
    DrawerContent,
    DrawerHeader,
    DrawerPositioner,
    DrawerRoot,
    Flex,
    HStack,
    SliderControl,
    SliderRange,
    SliderRoot,
    SliderThumb,
    SliderTrack,
    Stack,
    SwitchControl,
    SwitchHiddenInput,
    SwitchRoot,
    Text,
} from "@chakra-ui/react";
import { DEFAULT_PREFERENCES, type SurfaceStyle, usePreferences } from "@/lib/preferences";
import { ThemeSelector } from "@/components/ThemeSelector";

type PreferencesDrawerProps = {
    isOpen: boolean;
    onClose: () => void;
};

export function PreferencesDrawer({ isOpen, onClose }: PreferencesDrawerProps) {
    const {
        preferences,
        setFontSize,
        setCaretWidth,
        setCountdownEnabled,
        setShowLiveStatsDuringRun,
        setTheme,
        setSurfaceStyle,
        setInterfaceMode,
    } = usePreferences();

    const surfaceStyleOptions: Array<{ value: SurfaceStyle; label: string }> = [
        { value: "immersive", label: "Immersive" },
        { value: "panel", label: "Framed" },
    ];
    const interfaceModeOptions: Array<{ value: typeof preferences.interfaceMode; label: string; helper: string }> = [
        { value: "ide", label: "IDE layout", helper: "Chakra chrome with session framing" },
        { value: "terminal", label: "Terminal layout", helper: "Minimal framing with progress bar" },
    ];

    const resetToDefaults = () => {
        setTheme(DEFAULT_PREFERENCES.theme);
        setFontSize(DEFAULT_PREFERENCES.fontSize);
        setCaretWidth(DEFAULT_PREFERENCES.caretWidth);
        setCountdownEnabled(DEFAULT_PREFERENCES.countdownEnabled);
        setShowLiveStatsDuringRun(DEFAULT_PREFERENCES.showLiveStatsDuringRun);
        setSurfaceStyle(DEFAULT_PREFERENCES.surfaceStyle);
    };

    return (
        <DrawerRoot
            open={isOpen}
            placement="end"
            size="sm"
            onOpenChange={({ open }) => {
                if (!open) {
                    onClose();
                }
            }}
        >
            <DrawerBackdrop backdropFilter="blur(6px)" />
            <DrawerPositioner>
                <DrawerContent bg="rgba(15, 15, 15, 0.9)" borderLeft="1px solid var(--border)" backdropFilter="blur(12px)">
                    <CloseButton mt={2} position="absolute" top={2} right={2} onClick={onClose} />
                    <DrawerHeader borderBottomWidth="1px" borderColor="var(--border)">
                        Preferences
                    </DrawerHeader>
                    <DrawerBody>
                        <Stack gap={8} mt={4}>
                            <Box>
                                <Text fontSize="sm" fontWeight={600} mb={2}>
                                    Editor font size
                                </Text>
                                <HStack justify="space-between" mb={2}>
                                    <Text fontSize="xs" color="var(--text-subtle)">
                                        {preferences.fontSize}px
                                    </Text>
                                    <Text fontSize="xs" color="var(--text-subtle)">
                                        Range 16-36px
                                    </Text>
                                </HStack>
                                <SliderRoot
                                    value={[preferences.fontSize]}
                                    min={16}
                                    max={36}
                                    step={1}
                                    onValueChange={({ value }) => {
                                        if (value[0] != null) {
                                            setFontSize(value[0]);
                                        }
                                    }}
                                >
                                    <SliderControl>
                                        <SliderTrack bg="var(--surface)">
                                            <SliderRange bg="linear-gradient(90deg, var(--accent) 0%, transparent 100%)" />
                                        </SliderTrack>
                                        <SliderThumb index={0} boxSize={4} bg="var(--accent)" />
                                    </SliderControl>
                                </SliderRoot>
                            </Box>

                            <Box>
                                <Text fontSize="sm" fontWeight={600} mb={2}>
                                    Caret width
                                </Text>
                                <HStack justify="space-between" mb={2}>
                                    <Text fontSize="xs" color="var(--text-subtle)">
                                        {preferences.caretWidth.toFixed(1)}px
                                    </Text>
                                    <Text fontSize="xs" color="var(--text-subtle)">
                                        Range 2-6px
                                    </Text>
                                </HStack>
                                <SliderRoot
                                    value={[preferences.caretWidth]}
                                    min={2}
                                    max={6}
                                    step={0.2}
                                    onValueChange={({ value }) => {
                                        if (value[0] != null) {
                                            setCaretWidth(value[0]);
                                        }
                                    }}
                                >
                                    <SliderControl>
                                        <SliderTrack bg="var(--surface)">
                                            <SliderRange bg="linear-gradient(90deg, var(--accent) 0%, transparent 100%)" />
                                        </SliderTrack>
                                        <SliderThumb index={0} boxSize={4} bg="var(--accent)" />
                                    </SliderControl>
                                </SliderRoot>
                            </Box>

                            <Box>
                                <Text fontSize="sm" fontWeight={600} mb={2}>
                                    Countdown overlay
                                </Text>
                                <HStack justify="space-between" align="center">
                                    <Text fontSize="xs" color="var(--text-subtle)">
                                        Show 3…2…1 countdown before runs
                                    </Text>
                                    <SwitchRoot
                                        checked={preferences.countdownEnabled}
                                        onCheckedChange={({ checked }) => setCountdownEnabled(checked)}
                                        colorPalette="yellow"
                                        display="inline-flex"
                                        alignItems="center"
                                    >
                                        <SwitchControl />
                                        <SwitchHiddenInput />
                                    </SwitchRoot>
                                </HStack>
                            </Box>

                            <Box>
                                <Text fontSize="sm" fontWeight={600} mb={2}>
                                    Live stats during run
                                </Text>
                                <HStack justify="space-between" align="center">
                                    <Text fontSize="xs" color="var(--text-subtle)">
                                        Toggle live WPM panel (Cmd/Ctrl+Shift+L)
                                    </Text>
                                    <SwitchRoot
                                        checked={preferences.showLiveStatsDuringRun}
                                        onCheckedChange={({ checked }) => setShowLiveStatsDuringRun(checked)}
                                        colorPalette="yellow"
                                        display="inline-flex"
                                        alignItems="center"
                                    >
                                        <SwitchControl />
                                        <SwitchHiddenInput />
                                    </SwitchRoot>
                                </HStack>
                            </Box>

                            <Box>
                                <Text fontSize="sm" fontWeight={600} mb={3}>
                                    Theme
                                </Text>
                                <ThemeSelector />
                            </Box>

                            <Box>
                                <Text fontSize="sm" fontWeight={600} mb={3}>
                                    Interface layout
                                </Text>
                                <Stack gap={2}>
                                    {interfaceModeOptions.map((option) => {
                                        const active = preferences.interfaceMode === option.value;
                                        return (
                                            <Button
                                                key={option.value}
                                                justifyContent="space-between"
                                                height="auto"
                                                borderRadius="md"
                                                px={4}
                                                py={3}
                                                bg={active ? "var(--surface-active)" : "transparent"}
                                                color={active ? "var(--text)" : "var(--text-subtle)"}
                                                border="1px solid"
                                                borderColor={active ? "var(--border-strong)" : "var(--border)"}
                                                _hover={{ bg: "var(--surface-hover)", color: "var(--text)" }}
                                                onClick={() => setInterfaceMode(option.value)}
                                            >
                                                <Flex direction="column" align="flex-start" gap={1}>
                                                    <Text fontWeight={600}>{option.label}</Text>
                                                    <Text fontSize="xs" color="var(--text-subtle)" textAlign="start">
                                                        {option.helper}
                                                    </Text>
                                                </Flex>
                                            </Button>
                                        );
                                    })}
                                </Stack>
                            </Box>

                            <Box>
                                <Text fontSize="sm" fontWeight={600} mb={3}>
                                    Code surface
                                </Text>
                                <Flex gap={2} flexWrap="wrap">
                                    {surfaceStyleOptions.map((option) => {
                                        const active = preferences.surfaceStyle === option.value;
                                        return (
                                            <Button
                                                key={option.value}
                                                size="sm"
                                                borderRadius="full"
                                                px={4}
                                                py={2}
                                                bg={active ? "var(--surface-active)" : "transparent"}
                                                color={active ? "var(--text)" : "var(--text-subtle)"}
                                                border="1px solid"
                                                borderColor={active ? "var(--border-strong)" : "var(--border)"}
                                                _hover={{ bg: "var(--surface-hover)", color: "var(--text)" }}
                                                onClick={() => setSurfaceStyle(option.value)}
                                            >
                                                {option.label}
                                            </Button>
                                        );
                                    })}
                                </Flex>
                            </Box>

                            <Box borderBottom="1px solid var(--border)" />

                            <Button
                                variant="outline"
                                color="var(--text-subtle)"
                                borderColor="var(--border)"
                                _hover={{ bg: "var(--surface-hover)", color: "var(--text)" }}
                                onClick={resetToDefaults}
                            >
                                Reset to defaults
                            </Button>
                        </Stack>
                    </DrawerBody>
                </DrawerContent>
            </DrawerPositioner>
        </DrawerRoot>
    );
}

export default PreferencesDrawer;
