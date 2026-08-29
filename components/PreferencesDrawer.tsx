"use client";

import {
    Box,
    Button,
    DrawerBackdrop,
    DrawerBody,
    DrawerContent,
    DrawerHeader,
    DrawerPositioner,
    DrawerRoot,
    DrawerTitle,
    Flex,
    HStack,
    Portal,
    Separator,
    SliderControl,
    SliderLabel,
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
import { useCallback, useId, useRef, useState, type ReactNode } from "react";
import {
    DEFAULT_PREFERENCES,
    type InterfaceMode,
    type SurfaceStyle,
    type SyntaxHighlightingMode,
    usePreferences,
} from "@/lib/preferences";
import { ThemeSelector } from "@/components/ThemeSelector";
import { exportSessions, importSessions, downloadFile, type ImportResult } from "@/lib/export";
import { AIKeyConfig } from "@/components/AIKeyConfig";
import { SegmentedControl, type SegmentedOption } from "@/components/ui/SegmentedControl";
import { DrawerCloseButton } from "@/components/ui/DialogCloseButton";
import {
    overlayBackdropProps,
    overlayDrawerProps,
    overlayEyebrowProps,
    overlayHeaderProps,
} from "@/components/ui/overlay";

type PreferencesDrawerProps = {
    isOpen: boolean;
    onClose: () => void;
};

const syntaxHighlightingOptions: ReadonlyArray<SegmentedOption<SyntaxHighlightingMode>> = [
    { value: "full", label: "Full" },
    { value: "partial", label: "Partial" },
    { value: "none", label: "None" },
];

const surfaceStyleOptions: ReadonlyArray<SegmentedOption<SurfaceStyle>> = [
    { value: "immersive", label: "Immersive" },
    { value: "panel", label: "Framed" },
];

const interfaceModeOptions: ReadonlyArray<SegmentedOption<InterfaceMode>> = [
    { value: "ide", label: "IDE layout", helper: "Chakra chrome with session framing" },
    { value: "terminal", label: "Terminal layout", helper: "Minimal framing with progress bar" },
];

/** One labelled block inside the drawer. The eyebrow is the section's a11y name. */
function Section({ title, children }: { title: string; children: ReactNode }) {
    const headingId = useId();
    return (
        <Stack as="section" aria-labelledby={headingId} gap={5}>
            <Text id={headingId} {...overlayEyebrowProps}>
                {title}
            </Text>
            {children}
        </Stack>
    );
}

/** Setting name above its control, for controls that need the full width. */
function LabeledControl({ label, children }: { label: string; children: ReactNode }) {
    return (
        <Box>
            <Text fontSize="sm" fontWeight={600} mb={2} color="var(--text)">
                {label}
            </Text>
            {children}
        </Box>
    );
}

/** Setting name + one-line explanation on the left, control on the right. */
function SettingRow({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
    return (
        <Flex align="center" justify="space-between" gap={4}>
            <Box>
                <Text fontSize="sm" fontWeight={600} color="var(--text)">
                    {label}
                </Text>
                <Text fontSize="xs" color="var(--text-subtle)" mt={0.5}>
                    {hint}
                </Text>
            </Box>
            {children}
        </Flex>
    );
}

function ToggleRow({
    label,
    hint,
    checked,
    onChange,
}: {
    label: string;
    hint: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}) {
    return (
        <SettingRow label={label} hint={hint}>
            <SwitchRoot
                checked={checked}
                onCheckedChange={({ checked: next }) => onChange(next)}
                display="inline-flex"
                alignItems="center"
                flexShrink={0}
            >
                <SwitchControl />
                <SwitchHiddenInput aria-label={label} />
            </SwitchRoot>
        </SettingRow>
    );
}

function SliderSetting({
    label,
    valueLabel,
    rangeLabel,
    value,
    min,
    max,
    step,
    onChange,
}: {
    label: string;
    valueLabel: string;
    rangeLabel: string;
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (value: number) => void;
}) {
    return (
        <SliderRoot
            value={[value]}
            min={min}
            max={max}
            step={step}
            onValueChange={({ value: next }) => {
                if (next[0] != null) {
                    onChange(next[0]);
                }
            }}
        >
            <HStack justify="space-between" align="baseline" mb={2}>
                <SliderLabel fontSize="sm" fontWeight={600} color="var(--text)">
                    {label}
                </SliderLabel>
                <Text fontSize="xs" color="var(--text-subtle)" fontVariantNumeric="tabular-nums">
                    {valueLabel}
                    <Box as="span" opacity={0.7}>
                        {" "}
                        · {rangeLabel}
                    </Box>
                </Text>
            </HStack>
            {/* Rail, fill and knob colours come from the slider slot recipe in
                lib/chakra-system.ts so every slider in the app matches. */}
            <SliderControl>
                <SliderTrack>
                    <SliderRange />
                </SliderTrack>
                <SliderThumb index={0} boxSize={4} boxShadow="var(--elev-1)" />
            </SliderControl>
        </SliderRoot>
    );
}

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

    const [importStatus, setImportStatus] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const bodyRef = useRef<HTMLDivElement>(null);

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

    const dataButtonProps = {
        size: "sm",
        variant: "outline",
        borderColor: "var(--border)",
        color: "var(--text-subtle)",
        borderRadius: "var(--radius-sm)",
        _hover: { bg: "var(--surface-hover)", color: "var(--text)" },
    } as const;

    /** Reset throws away every setting, so it wears the destructive outline. */
    const resetButtonProps = {
        ...dataButtonProps,
        borderColor: "color-mix(in srgb, var(--error) 52%, transparent)",
        color: "var(--error)",
        _hover: { bg: "color-mix(in srgb, var(--error) 14%, transparent)", color: "var(--error)" },
    } as const;

    return (
        <DrawerRoot
            open={isOpen}
            placement="end"
            size="sm"
            // Without this the drawer autofocuses its close button, so the first
            // thing a keyboard user sees is a focus ring pinned to the viewport edge.
            initialFocusEl={() => bodyRef.current}
            onOpenChange={({ open }) => {
                if (!open) {
                    onClose();
                }
            }}
        >
            <Portal>
                <DrawerBackdrop {...overlayBackdropProps} />
                <DrawerPositioner>
                    <DrawerContent {...overlayDrawerProps}>
                        <DrawerCloseButton />
                        <DrawerHeader {...overlayHeaderProps}>
                            <DrawerTitle>Preferences</DrawerTitle>
                        </DrawerHeader>
                        <DrawerBody ref={bodyRef} tabIndex={-1} outline="none">
                            <Stack
                                gap={8}
                                mt={2}
                                pb={6}
                                separator={<Separator borderColor="var(--border)" />}
                            >
                                <Section title="Appearance">
                                    <LabeledControl label="Theme">
                                        <ThemeSelector />
                                    </LabeledControl>
                                    <LabeledControl label="Interface layout">
                                        <SegmentedControl
                                            label="Interface layout"
                                            orientation="vertical"
                                            options={interfaceModeOptions}
                                            value={preferences.interfaceMode}
                                            onChange={setInterfaceMode}
                                        />
                                    </LabeledControl>
                                    <LabeledControl label="Code surface">
                                        <SegmentedControl
                                            label="Code surface"
                                            options={surfaceStyleOptions}
                                            value={preferences.surfaceStyle}
                                            onChange={setSurfaceStyle}
                                        />
                                    </LabeledControl>
                                    <LabeledControl label="Syntax highlighting">
                                        <SegmentedControl
                                            label="Syntax highlighting"
                                            options={syntaxHighlightingOptions}
                                            value={preferences.syntaxHighlighting}
                                            onChange={setSyntaxHighlighting}
                                        />
                                    </LabeledControl>
                                </Section>

                                <Section title="Typing">
                                    <SliderSetting
                                        label="Editor font size"
                                        valueLabel={`${preferences.fontSize}px`}
                                        rangeLabel="16-36px"
                                        value={preferences.fontSize}
                                        min={16}
                                        max={36}
                                        step={1}
                                        onChange={setFontSize}
                                    />
                                    <SliderSetting
                                        label="Caret width"
                                        valueLabel={`${preferences.caretWidth.toFixed(1)}px`}
                                        rangeLabel="2-6px"
                                        value={preferences.caretWidth}
                                        min={2}
                                        max={6}
                                        step={0.2}
                                        onChange={setCaretWidth}
                                    />
                                    <ToggleRow
                                        label="Countdown overlay"
                                        hint="Show 3…2…1 before runs"
                                        checked={preferences.countdownEnabled}
                                        onChange={setCountdownEnabled}
                                    />
                                    <ToggleRow
                                        label="Vim mode"
                                        hint="Enable Vim keybindings"
                                        checked={preferences.vimMode}
                                        onChange={setVimMode}
                                    />
                                    <ToggleRow
                                        label="Live stats during run"
                                        hint="Toggle live WPM panel (Cmd/Ctrl+Shift+L)"
                                        checked={preferences.showLiveStatsDuringRun}
                                        onChange={setShowLiveStatsDuringRun}
                                    />
                                </Section>

                                <Section title="Practice">
                                    <ToggleRow
                                        label="Spaced repetition"
                                        hint="Smart review scheduling based on your performance"
                                        checked={preferences.spacedRepetitionEnabled}
                                        onChange={setSpacedRepetitionEnabled}
                                    />
                                    <ToggleRow
                                        label="Adaptive difficulty"
                                        hint="Auto-adjust difficulty to match your skill level"
                                        checked={preferences.adaptiveDifficultyEnabled}
                                        onChange={setAdaptiveDifficultyEnabled}
                                    />
                                </Section>

                                <Section title="AI drills">
                                    <AIKeyConfig />
                                </Section>

                                <Section title="Data">
                                    <Stack gap={2}>
                                        <Flex gap={2}>
                                            <Button {...dataButtonProps} onClick={handleExportJSON} flex={1}>
                                                Export JSON
                                            </Button>
                                            <Button {...dataButtonProps} onClick={handleExportCSV} flex={1}>
                                                Export CSV
                                            </Button>
                                        </Flex>
                                        <Button {...dataButtonProps} onClick={() => fileInputRef.current?.click()}>
                                            Import data
                                        </Button>
                                        <input
                                            ref={fileInputRef}
                                            aria-label="Import preferences JSON file"
                                            type="file"
                                            accept=".json"
                                            onChange={handleImport}
                                            style={{ display: "none" }}
                                        />
                                        {importStatus && (
                                            <Text fontSize="xs" color="var(--accent)" aria-live="polite">
                                                {importStatus}
                                            </Text>
                                        )}
                                        <Button {...resetButtonProps} mt={2} onClick={resetToDefaults}>
                                            Reset to defaults
                                        </Button>
                                    </Stack>
                                </Section>
                            </Stack>
                        </DrawerBody>
                    </DrawerContent>
                </DrawerPositioner>
            </Portal>
        </DrawerRoot>
    );
}

export default PreferencesDrawer;
