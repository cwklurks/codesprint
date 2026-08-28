"use client";

import {
    Box,
    CloseButton,
    DrawerBackdrop,
    DrawerBody,
    DrawerContent,
    DrawerHeader,
    DrawerPositioner,
    DrawerRoot,
    Flex,
    Portal,
    Stack,
    Text,
} from "@chakra-ui/react";
import { KEYBOARD_SHORTCUTS } from "@/lib/shortcuts";
import { overlayBackdropProps, overlayDrawerProps, overlayHeaderProps } from "@/components/ui/overlay";

type ShortcutsDrawerProps = {
    isOpen: boolean;
    onClose: () => void;
};

export function ShortcutsDrawer({ isOpen, onClose }: ShortcutsDrawerProps) {
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
            <Portal>
                <DrawerBackdrop {...overlayBackdropProps} />
                <DrawerPositioner>
                    <DrawerContent {...overlayDrawerProps}>
                        <CloseButton
                            mt={2}
                            position="absolute"
                            top={2}
                            right={2}
                            color="var(--text-subtle)"
                            _hover={{ bg: "var(--surface-hover)", color: "var(--text)" }}
                            onClick={onClose}
                        />
                        <DrawerHeader {...overlayHeaderProps}>Keyboard shortcuts</DrawerHeader>
                        <DrawerBody>
                            <Stack gap={6} mt={4}>
                                <Text color="var(--text-subtle)" fontSize="sm">
                                    Stay on the keys, every action has a gesture.
                                </Text>
                                <Stack gap={4}>
                                    {KEYBOARD_SHORTCUTS.map((shortcut) => (
                                        <Flex
                                            key={shortcut.combo}
                                            align="center"
                                            gap={4}
                                            flexWrap="wrap"
                                            justify="space-between"
                                        >
                                            <Box
                                                px={3}
                                                py={2}
                                                minW={12}
                                                borderRadius="var(--radius-sm)"
                                                border="1px solid var(--border)"
                                                bg="var(--surface)"
                                                boxShadow="var(--elev-1)"
                                                fontFamily="var(--font-mono), ui-monospace, Menlo, Consolas, monospace"
                                                fontWeight={600}
                                                fontSize="md"
                                                textAlign="center"
                                                color="var(--text)"
                                                letterSpacing="0.02em"
                                            >
                                                {shortcut.combo}
                                            </Box>
                                            <Text flex="1" color="var(--text-subtle)" fontSize="sm" minW="200px">
                                                {shortcut.detail}
                                            </Text>
                                        </Flex>
                                    ))}
                                </Stack>
                            </Stack>
                        </DrawerBody>
                    </DrawerContent>
                </DrawerPositioner>
            </Portal>
        </DrawerRoot>
    );
}

export default ShortcutsDrawer;
