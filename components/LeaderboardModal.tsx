"use client";

import {
    Button,
    DialogBody,
    DialogCloseTrigger,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogRoot,
    DialogTitle,
    DialogTrigger,
    Table,
    Text,
    Flex,
    Badge,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { getLeaderboard, clearLeaderboard, type LeaderboardEntry } from "@/lib/leaderboard";

type LeaderboardModalProps = {
    isOpen: boolean;
    onOpenChange: (details: { open: boolean }) => void;
};

export default function LeaderboardModal({ isOpen, onOpenChange }: LeaderboardModalProps) {
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

    useEffect(() => {
        if (isOpen) {
            setEntries(getLeaderboard());
        }
    }, [isOpen]);

    const handleClear = () => {
        if (confirm("Are you sure you want to clear your history? This cannot be undone.")) {
            clearLeaderboard();
            setEntries([]);
        }
    };

    return (
        <DialogRoot open={isOpen} onOpenChange={onOpenChange} size="lg" placement="center" scrollBehavior="inside">
            <DialogContent bg="var(--panel-soft)" backdropFilter="blur(12px)" border="1px solid var(--border)">
                <DialogHeader borderBottom="1px solid var(--border)">
                    <DialogTitle fontSize="xl" fontWeight="bold" color="var(--accent)">
                        Local Leaderboard
                    </DialogTitle>
                </DialogHeader>
                <DialogBody py={4}>
                    {entries.length === 0 ? (
                        <Flex justify="center" align="center" h="200px" direction="column" gap={2}>
                            <Text color="var(--text-subtle)">No scores yet.</Text>
                            <Text fontSize="sm" color="var(--text-subtle)">Complete a typing test to see your rank!</Text>
                        </Flex>
                    ) : (
                        <Table.Root size="sm" interactive>
                            <Table.Header>
                                <Table.Row>
                                    <Table.ColumnHeader color="var(--text-subtle)">Rank</Table.ColumnHeader>
                                    <Table.ColumnHeader color="var(--text-subtle)">WPM</Table.ColumnHeader>
                                    <Table.ColumnHeader color="var(--text-subtle)">Accuracy</Table.ColumnHeader>
                                    <Table.ColumnHeader color="var(--text-subtle)">Language</Table.ColumnHeader>
                                    <Table.ColumnHeader color="var(--text-subtle)">Date</Table.ColumnHeader>
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {entries.map((entry, index) => (
                                    <Table.Row key={entry.id} _hover={{ bg: "var(--surface-hover)" }}>
                                        <Table.Cell fontWeight="bold" color={index < 3 ? "var(--accent)" : "var(--text)"}>
                                            #{index + 1}
                                        </Table.Cell>
                                        <Table.Cell fontWeight="bold">{Math.round(entry.wpm)}</Table.Cell>
                                        <Table.Cell>{Math.round(entry.accuracy)}%</Table.Cell>
                                        <Table.Cell>
                                            <Badge variant="subtle" colorScheme="blue" size="sm">
                                                {entry.language}
                                            </Badge>
                                        </Table.Cell>
                                        <Table.Cell color="var(--text-subtle)" fontSize="xs">
                                            {new Date(entry.date).toLocaleDateString()}
                                        </Table.Cell>
                                    </Table.Row>
                                ))}
                            </Table.Body>
                        </Table.Root>
                    )}
                </DialogBody>
                <DialogFooter borderTop="1px solid var(--border)">
                    <Button variant="ghost" color="var(--error)" size="sm" onClick={handleClear} mr="auto">
                        Clear History
                    </Button>
                    <DialogCloseTrigger asChild>
                        <Button variant="outline" borderColor="var(--border)" color="var(--text)">
                            Close
                        </Button>
                    </DialogCloseTrigger>
                </DialogFooter>
                <DialogCloseTrigger />
            </DialogContent>
        </DialogRoot>
    );
}
