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
    Stack,
    Text,
} from "@chakra-ui/react";
import { KEYBOARD_SHORTCUTS } from "@/lib/shortcuts";

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
            <DrawerBackdrop backdropFilter="blur(6px)" />
            <DrawerPositioner>
                <DrawerContent bg="var(--panel)" borderLeft="1px solid var(--border)" backdropFilter="blur(18px)">
                    <CloseButton mt={2} position="absolute" top={2} right={2} onClick={onClose} />
                    <DrawerHeader borderBottomWidth="1px" borderColor="var(--border)">
                        Keyboard shortcuts
                    </DrawerHeader>
                    <DrawerBody>
                        <Stack gap={6} mt={4}>
                            <Text color="var(--text-subtle)" fontSize="sm">
                                Stay on the keys—every action has a gesture.
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
                                            borderRadius="md"
                                            border="1px solid var(--border)"
                                            bg="var(--surface)"
                                            fontFamily='"IBM Plex Mono", "JetBrains Mono", monospace'
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
        </DrawerRoot>
    );
}

export default ShortcutsDrawer;

