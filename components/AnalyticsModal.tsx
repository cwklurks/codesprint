"use client";

import {
    DialogBackdrop,
    DialogBody,
    DialogContent,
    DialogHeader,
    DialogPositioner,
    DialogRoot,
    DialogTitle,
    Portal,
} from "@chakra-ui/react";
import AnalyticsDashboard from "@/components/analytics/AnalyticsDashboard";
import { DialogCloseButton } from "@/components/ui/DialogCloseButton";
import {
    overlayBackdropProps,
    overlayDialogProps,
    overlayHeaderProps,
} from "@/components/ui/overlay";

type AnalyticsModalProps = {
    isOpen: boolean;
    onOpenChange: (details: { open: boolean }) => void;
};

export default function AnalyticsModal({ isOpen, onOpenChange }: AnalyticsModalProps) {
    return (
        <DialogRoot
            open={isOpen}
            onOpenChange={onOpenChange}
            size="xl"
            placement="center"
            scrollBehavior="inside"
        >
            <Portal>
                <DialogBackdrop {...overlayBackdropProps} />
                <DialogPositioner>
                    <DialogContent {...overlayDialogProps}>
                        <DialogCloseButton />
                        <DialogHeader {...overlayHeaderProps}>
                            <DialogTitle fontSize="xl" fontWeight="bold" color="var(--accent)">Analytics</DialogTitle>
                        </DialogHeader>
                        <DialogBody py={4}>
                            <AnalyticsDashboard />
                        </DialogBody>
                    </DialogContent>
                </DialogPositioner>
            </Portal>
        </DialogRoot>
    );
}
