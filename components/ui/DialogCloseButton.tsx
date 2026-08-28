"use client";

import { CloseButton, DialogCloseTrigger } from "@chakra-ui/react";

/**
 * The dismiss control every dialog gets, top-right of the header.
 *
 * A bare `<DialogCloseTrigger />` renders an empty, unlabelled button (Chakra
 * forwards children through `asChild`), so it must always wrap a real control.
 */
export function DialogCloseButton() {
    return (
        <DialogCloseTrigger asChild>
            <CloseButton
                size="sm"
                aria-label="Close"
                color="var(--text-subtle)"
                _hover={{ bg: "var(--surface-hover)", color: "var(--text)" }}
            />
        </DialogCloseTrigger>
    );
}
