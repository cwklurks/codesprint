"use client";

import {
    Badge,
    Button,
    DialogBackdrop,
    DialogBody,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogPositioner,
    DialogRoot,
    DialogTitle,
    Flex,
    Portal,
    Table,
    Text,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { getLeaderboard, clearLeaderboard, type LeaderboardEntry } from "@/lib/leaderboard";
import { EmptyState } from "@/components/ui/EmptyState";
import { DialogCloseButton } from "@/components/ui/DialogCloseButton";
import {
    overlayBackdropProps,
    overlayDialogProps,
    overlayFooterProps,
    overlayHeaderProps,
} from "@/components/ui/overlay";

type LeaderboardModalProps = {
    isOpen: boolean;
    onOpenChange: (details: { open: boolean }) => void;
};

function TrophyGlyph() {
    return (
        <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
        >
            <path d="M8 21h8" />
            <path d="M12 17v4" />
            <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
            <path d="M17 5h3v2a3 3 0 0 1-3 3" />
            <path d="M7 5H4v2a3 3 0 0 0 3 3" />
        </svg>
    );
}

export default function LeaderboardModal({ isOpen, onOpenChange }: LeaderboardModalProps) {
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [confirmingClear, setConfirmingClear] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setEntries(getLeaderboard());
            setConfirmingClear(false);
        }
    }, [isOpen]);

    const handleClear = () => {
        clearLeaderboard();
        setEntries([]);
        setConfirmingClear(false);
    };

    return (
        <DialogRoot open={isOpen} onOpenChange={onOpenChange} size="lg" placement="center" scrollBehavior="inside">
            <Portal>
                <DialogBackdrop {...overlayBackdropProps} />
                <DialogPositioner>
                    <DialogContent {...overlayDialogProps}>
                        <DialogCloseButton />
                        <DialogHeader {...overlayHeaderProps}>
                            <DialogTitle fontSize="xl" fontWeight="bold" color="var(--accent)">
                                Local leaderboard
                            </DialogTitle>
                        </DialogHeader>
                        <DialogBody py={4}>
                            {entries.length === 0 ? (
                                <EmptyState
                                    glyph={<TrophyGlyph />}
                                    title="No scores yet"
                                    hint="Finish a run and your best results land here."
                                />
                            ) : (
                                <Table.Root size="sm" interactive>
                                    <Table.Header>
                                        <Table.Row bg="transparent">
                                            <Table.ColumnHeader color="var(--text-subtle)">Rank</Table.ColumnHeader>
                                            <Table.ColumnHeader color="var(--text-subtle)">WPM</Table.ColumnHeader>
                                            <Table.ColumnHeader color="var(--text-subtle)">Accuracy</Table.ColumnHeader>
                                            <Table.ColumnHeader color="var(--text-subtle)">Language</Table.ColumnHeader>
                                            <Table.ColumnHeader color="var(--text-subtle)">Date</Table.ColumnHeader>
                                        </Table.Row>
                                    </Table.Header>
                                    <Table.Body>
                                        {entries.map((entry, index) => (
                                            <Table.Row
                                                key={entry.id}
                                                bg="transparent"
                                                _hover={{ bg: "var(--surface-hover)" }}
                                            >
                                                <Table.Cell
                                                    fontWeight="bold"
                                                    fontVariantNumeric="tabular-nums"
                                                    color={index < 3 ? "var(--accent)" : "var(--text)"}
                                                >
                                                    #{index + 1}
                                                </Table.Cell>
                                                <Table.Cell fontWeight="bold" fontVariantNumeric="tabular-nums">
                                                    {Math.round(entry.wpm)}
                                                </Table.Cell>
                                                <Table.Cell fontVariantNumeric="tabular-nums">
                                                    {Math.round(entry.accuracy)}%
                                                </Table.Cell>
                                                <Table.Cell>
                                                    <Badge
                                                        variant="subtle"
                                                        bg="var(--surface)"
                                                        color="var(--accent)"
                                                        borderRadius="var(--radius-sm)"
                                                        size="sm"
                                                    >
                                                        {entry.language}
                                                    </Badge>
                                                </Table.Cell>
                                                <Table.Cell
                                                    color="var(--text-subtle)"
                                                    fontSize="xs"
                                                    fontVariantNumeric="tabular-nums"
                                                >
                                                    {new Date(entry.date).toLocaleDateString()}
                                                </Table.Cell>
                                            </Table.Row>
                                        ))}
                                    </Table.Body>
                                </Table.Root>
                            )}
                        </DialogBody>
                        {/* Nothing to clear means nothing to put in the footer: a
                            destructive action over an empty list is an invitation to
                            nowhere. Dismissal is the header's close button, the same
                            one every other overlay uses. */}
                        {entries.length > 0 && (
                            <DialogFooter {...overlayFooterProps}>
                                {confirmingClear ? (
                                    <Flex align="center" gap={2} mr="auto">
                                        <Text fontSize="sm" color="var(--text-subtle)">
                                            Clear all history?
                                        </Text>
                                        <Button
                                            variant="solid"
                                            bg="var(--error)"
                                            color="var(--bg)"
                                            borderRadius="var(--radius-sm)"
                                            size="sm"
                                            onClick={handleClear}
                                        >
                                            Clear history
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            color="var(--text-subtle)"
                                            size="sm"
                                            onClick={() => setConfirmingClear(false)}
                                        >
                                            Cancel
                                        </Button>
                                    </Flex>
                                ) : (
                                    <Button
                                        variant="ghost"
                                        color="var(--error)"
                                        size="sm"
                                        onClick={() => setConfirmingClear(true)}
                                        mr="auto"
                                    >
                                        Clear history
                                    </Button>
                                )}
                            </DialogFooter>
                        )}
                    </DialogContent>
                </DialogPositioner>
            </Portal>
        </DialogRoot>
    );
}
