"use client";

import {
    Box,
    DrawerBackdrop,
    DrawerBody,
    DrawerContent,
    DrawerHeader,
    DrawerPositioner,
    DrawerRoot,
    DrawerTitle,
    Grid,
    Portal,
    Stack,
    Text,
} from "@chakra-ui/react";
import { Fragment, useRef } from "react";
import { KEYBOARD_SHORTCUTS } from "@/lib/shortcuts";
import { DrawerCloseButton } from "@/components/ui/DialogCloseButton";
import { overlayBackdropProps, overlayDrawerProps, overlayHeaderProps } from "@/components/ui/overlay";

type ShortcutsDrawerProps = {
    isOpen: boolean;
    onClose: () => void;
};

/**
 * Wide enough for the longest combo in `KEYBOARD_SHORTCUTS`. Fixing the key
 * column means every description starts on the same x, instead of stepping in
 * and out with the width of each chip.
 */
const KEY_COLUMN = "104px";

export function ShortcutsDrawer({ isOpen, onClose }: ShortcutsDrawerProps) {
    const bodyRef = useRef<HTMLDivElement>(null);

    return (
        <DrawerRoot
            open={isOpen}
            placement="end"
            size="sm"
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
                            <DrawerTitle>Keyboard shortcuts</DrawerTitle>
                        </DrawerHeader>
                        <DrawerBody ref={bodyRef} tabIndex={-1} outline="none">
                            <Stack gap={6} mt={4}>
                                <Text color="var(--text-subtle)" fontSize="sm">
                                    Stay on the keys, every action has a gesture.
                                </Text>
                                <Grid
                                    templateColumns={`${KEY_COLUMN} minmax(0, 1fr)`}
                                    columnGap={4}
                                    rowGap={3}
                                    alignItems="center"
                                >
                                    {KEYBOARD_SHORTCUTS.map((shortcut) => (
                                        <Fragment key={shortcut.combo}>
                                            <Box
                                                px={3}
                                                py={2}
                                                borderRadius="var(--radius-sm)"
                                                border="1px solid var(--border)"
                                                bg="var(--surface)"
                                                boxShadow="var(--elev-1)"
                                                fontFamily="var(--font-mono), ui-monospace, Menlo, Consolas, monospace"
                                                fontWeight={600}
                                                fontSize="sm"
                                                textAlign="center"
                                                color="var(--text)"
                                                letterSpacing="0.02em"
                                                whiteSpace="nowrap"
                                            >
                                                {shortcut.combo}
                                            </Box>
                                            <Text color="var(--text-subtle)" fontSize="sm">
                                                {shortcut.detail}
                                            </Text>
                                        </Fragment>
                                    ))}
                                </Grid>
                            </Stack>
                        </DrawerBody>
                    </DrawerContent>
                </DrawerPositioner>
            </Portal>
        </DrawerRoot>
    );
}

export default ShortcutsDrawer;
