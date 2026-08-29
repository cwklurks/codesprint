"use client";

import { Skeleton, VStack } from "@chakra-ui/react";

const SKELETON_ROWS: ReadonlyArray<{ id: string; width: string }> = [
    { id: "row-100", width: "100%" },
    { id: "row-85", width: "85%" },
    { id: "row-60", width: "60%" },
    { id: "row-90", width: "90%" },
    { id: "row-75", width: "75%" },
    { id: "row-40", width: "40%" },
    { id: "row-70", width: "70%" },
];

/** The shine sweep reads off the theme surfaces rather than Chakra's own ramp. */
const SHINE = {
    "--start-color": "var(--surface)",
    "--end-color": "var(--surface-active)",
    "--duration": "2.4s",
} as const;

export function AILoadingSkeleton() {
    return (
        <VStack gap={2} align="stretch" width="100%" aria-busy="true" aria-label="Generating drill">
            {SKELETON_ROWS.map((row) => (
                <Skeleton
                    key={row.id}
                    variant="shine"
                    css={SHINE}
                    height="1.5em"
                    width={row.width}
                    borderRadius="var(--radius-sm)"
                />
            ))}
        </VStack>
    );
}
