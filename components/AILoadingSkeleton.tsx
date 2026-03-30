"use client";

import { Skeleton, VStack } from "@chakra-ui/react";

export function AILoadingSkeleton() {
    const widths = ["100%", "85%", "60%", "90%", "75%", "40%", "70%"];

    return (
        <VStack gap={2} align="stretch" width="100%">
            {widths.map((width, i) => (
                <Skeleton key={i} height="1.5em" width={width} />
            ))}
        </VStack>
    );
}
