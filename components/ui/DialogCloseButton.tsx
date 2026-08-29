"use client";

import { CloseButton, DialogCloseTrigger, DrawerCloseTrigger } from "@chakra-ui/react";

/**
 * The dismiss control every overlay gets, top-right of the header.
 *
 * One treatment for dialogs and drawers alike: same glyph, same size, same
 * inset. The stock recipes park the trigger at `top/insetEnd: 2` (8px), which
 * reads as hanging off the edge next to a 24px header inset -- 16px puts the
 * glyph's optical edge on the same line as the title's left padding.
 *
 * A bare `<DialogCloseTrigger />` renders an empty, unlabelled button (Chakra
 * forwards children through `asChild`), so it must always wrap a real control.
 */
const closeButtonProps = {
    size: "sm",
    "aria-label": "Close",
    top: "4",
    insetEnd: "4",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-subtle)",
    _hover: { bg: "var(--surface-hover)", color: "var(--text)" },
} as const;

export function DialogCloseButton() {
    return (
        <DialogCloseTrigger asChild>
            <CloseButton {...closeButtonProps} />
        </DialogCloseTrigger>
    );
}

/** Same control, wired to the drawer slot recipe's close trigger. */
export function DrawerCloseButton() {
    return (
        <DrawerCloseTrigger asChild>
            <CloseButton {...closeButtonProps} />
        </DrawerCloseTrigger>
    );
}
