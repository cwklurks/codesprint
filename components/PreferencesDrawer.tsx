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
import { useCallback, useRef, useState } from "react";
import {
    DEFAULT_PREFERENCES,
    type SurfaceStyle,
    type SyntaxHighlightingMode,
    usePreferences,
} from "@/lib/preferences";
import { ThemeSelector } from "@/components/ThemeSelector";
import { exportSessions, importSessions, downloadFile, type ImportResult } from "@/lib/export";
import { AIKeyConfig } from "@/components/AIKeyConfig";

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
        setVimMode,
        setSyntaxHighlighting,
        setSpacedRepetitionEnabled,
        setAdaptiveDifficultyEnabled,
    } = usePreferences();

    const syntaxHighlightingOptions: Array<{ value: SyntaxHighlightingMode; label: string }> = [
        { value: "full", label: "Full" },
        { value: "partial", label: "Partial" },
        { value: "none", label: "None" },
    ];

    const surfaceStyleOptions: Array<{ value: SurfaceStyle; label: string }> = [
        { value: "immersive", label: "Immersive" },
        { value: "panel", label: "Framed" },
    ];
    const interfaceModeOptions: Array<{ value: typeof preferences.interfaceMode; label: string; helper: string }> = [
        { value: "ide", label: "IDE layout", helper: "Chakra chrome with session framing" },
        { value: "terminal", label: "Terminal layout", helper: "Minimal framing with progress bar" },
    ];

    const [importStatus, setImportStatus] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const resetToDefaults = () => {
        setTheme(DEFAULT_PREFERENCES.theme);
        setFontSize(DEFAULT_PREFERENCES.fontSize);
        setCaretWidth(DEFAULT_PREFERENCES.caretWidth);
        setCountdownEnabled(DEFAULT_PREFERENCES.countdownEnabled);
        setShowLiveStatsDuringRun(DEFAULT_PREFERENCES.showLiveStatsDuringRun);
        setSurfaceStyle(DEFAULT_PREFERENCES.surfaceStyle);
        setVimMode(DEFAULT_PREFERENCES.vimMode);
        setSyntaxHighlighting(DEFAULT_PREFERENCES.syntaxHighlighting);
        setInterfaceMode(DEFAULT_PREFERENCES.interfaceMode);
        setSpacedRepetitionEnabled(DEFAULT_PREFERENCES.spacedRepetitionEnabled);
        setAdaptiveDifficultyEnabled(DEFAULT_PREFERENCES.adaptiveDifficultyEnabled);
    };

    const handleExportJSON = useCallback(async () => {
        try {
            const data = await exportSessions("json");
            const date = new Date().toISOString().slice(0, 10);
            downloadFile(data, `codesprint-${date}.json`, "application/json");
        } catch {
            setImportStatus("Export failed");
        }
    }, []);

    const handleExportCSV = useCallback(async () => {
        try {
            const data = await exportSessions("csv");
            const date = new Date().toISOString().slice(0, 10);
            downloadFile(data, `codesprint-${date}.csv`, "text/csv");
        } catch {
            setImportStatus("Export failed");
        }
    }, []);

    const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const result: ImportResult = await importSessions(text);
            setImportStatus(
                `Imported ${result.imported} sessions` +
                (result.duplicates > 0 ? `, ${result.duplicates} duplicates skipped` : "") +
                (result.invalid > 0 ? `, ${result.invalid} invalid` : "")
            );
        } catch {
            setImportStatus("Import failed - invalid file");
        }

        // Reset file input
        if (fileInputRef.current) fileInputRef.current.value = "";
    }, []);

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
                <DrawerContent bg="var(--header-bg)" borderLeft="1px solid var(--border)" backdropFilter="blur(12px)">
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
                                    Vim Mode
                                </Text>
                                <HStack justify="space-between" align="center">
                                    <Text fontSize="xs" color="var(--text-subtle)">
                                        Enable Vim keybindings
                                    </Text>
                                    <SwitchRoot
                                        checked={preferences.vimMode}
                                        onCheckedChange={({ checked }) => setVimMode(checked)}
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
                                    Syntax Highlighting
                                </Text>
                                <Flex gap={2} flexWrap="wrap">
                                    {syntaxHighlightingOptions.map((option) => {
                                        const active = preferences.syntaxHighlighting === option.value;
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
                                                onClick={() => setSyntaxHighlighting(option.value)}
                                            >
                                                {option.label}
                                            </Button>
                                        );
                                    })}
                                </Flex>
                            </Box>

                            <Box>
                                <Text fontSize="sm" fontWeight={600} mb={2}>
                                    Spaced Repetition
                                </Text>
                                <HStack justify="space-between" align="center">
                                    <Text fontSize="xs" color="var(--text-subtle)">
                                        Smart review scheduling based on your performance
                                    </Text>
                                    <SwitchRoot
                                        checked={preferences.spacedRepetitionEnabled}
                                        onCheckedChange={({ checked }) => setSpacedRepetitionEnabled(checked)}
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
                                    Adaptive Difficulty
                                </Text>
                                <HStack justify="space-between" align="center">
                                    <Text fontSize="xs" color="var(--text-subtle)">
                                        Auto-adjust difficulty to match your skill level
                                    </Text>
                                    <SwitchRoot
                                        checked={preferences.adaptiveDifficultyEnabled}
                                        onCheckedChange={({ checked }) => setAdaptiveDifficultyEnabled(checked)}
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
                                    AI Drills
                                </Text>
                                <AIKeyConfig />
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

                            <Box>
                                <Text fontSize="sm" fontWeight={600} mb={3}>
                                    Data
                                </Text>
                                <Stack gap={2}>
                                    <Flex gap={2}>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            borderColor="var(--border)"
                                            color="var(--text-subtle)"
                                            _hover={{ bg: "var(--surface-hover)", color: "var(--text)" }}
                                            onClick={handleExportJSON}
                                            flex={1}
                                        >
                                            Export JSON
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            borderColor="var(--border)"
                                            color="var(--text-subtle)"
                                            _hover={{ bg: "var(--surface-hover)", color: "var(--text)" }}
                                            onClick={handleExportCSV}
                                            flex={1}
                                        >
                                            Export CSV
                                        </Button>
                                    </Flex>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        borderColor="var(--border)"
                                        color="var(--text-subtle)"
                                        _hover={{ bg: "var(--surface-hover)", color: "var(--text)" }}
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        Import Data
                                    </Button>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".json"
                                        onChange={handleImport}
                                        style={{ display: "none" }}
                                    />
                                    {importStatus && (
                                        <Text fontSize="xs" color="var(--accent)">
                                            {importStatus}
                                        </Text>
                                    )}
                                </Stack>
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
