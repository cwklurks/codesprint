import { Box, Flex, Text } from "@chakra-ui/react";

type GapBufferVisualizerProps = {
    content: string;
    cursorIndex: number;
};

export default function GapBufferVisualizer({ content, cursorIndex }: GapBufferVisualizerProps) {
    const safeIndex = Math.max(0, Math.min(cursorIndex, content.length));

    // Simulate a gap buffer:
    // [ Left Buffer ] [ GAP ] [ Right Buffer ]
    // We'll show a fixed "gap size" for visualization purposes, 
    // even though in a real gap buffer the gap size varies.

    const left = content.slice(0, safeIndex);
    const right = content.slice(safeIndex);

    // For visualization, we'll take a window around the cursor so we don't render the whole string
    const WINDOW_SIZE = 20;
    const leftWindow = left.slice(-WINDOW_SIZE);
    const rightWindow = right.slice(0, WINDOW_SIZE);

    const leftOverflow = left.length > WINDOW_SIZE;
    const rightOverflow = right.length > WINDOW_SIZE;

    return (
        <Box
            mt={4}
            p={4}
            bg="var(--terminal-bg)"
            borderRadius="md"
            border="1px solid var(--border)"
            fontFamily="monospace"
            fontSize="sm"
        >
            <Text fontSize="xs" color="var(--text-subtle)" mb={2} textTransform="uppercase" letterSpacing="wider">
                Gap Buffer Debug View
            </Text>
            <Flex align="center" justify="center" gap={0} overflow="hidden">
                {/* Left Buffer */}
                <Box
                    p={2}
                    bg="var(--surface)"
                    border="1px solid var(--border)"
                    borderRight="none"
                    borderTopLeftRadius="md"
                    borderBottomLeftRadius="md"
                    minW="100px"
                    textAlign="right"
                    color="var(--text)"
                    whiteSpace="pre"
                >
                    {leftOverflow ? "..." : ""}
                    {leftWindow.replace(/\n/g, "↵")}
                </Box>

                {/* The Gap */}
                <Box
                    p={2}
                    bg="var(--accent)"
                    color="var(--bg)"
                    fontWeight="bold"
                    minW="60px"
                    textAlign="center"
                    position="relative"
                >
                    GAP
                    <Text fontSize="xx-small" position="absolute" bottom="1px" left="0" right="0" opacity={0.8}>
                        cursor: {safeIndex}
                    </Text>
                </Box>

                {/* Right Buffer */}
                <Box
                    p={2}
                    bg="var(--surface)"
                    border="1px solid var(--border)"
                    borderLeft="none"
                    borderTopRightRadius="md"
                    borderBottomRightRadius="md"
                    minW="100px"
                    textAlign="left"
                    color="var(--text)"
                    whiteSpace="pre"
                >
                    {rightWindow.replace(/\n/g, "↵")}
                    {rightOverflow ? "..." : ""}
                </Box>
            </Flex>
            <Flex justify="space-between" mt={2} fontSize="xs" color="var(--text-subtle)">
                <Text>Left: {left.length} chars</Text>
                <Text>Right: {right.length} chars</Text>
            </Flex>
        </Box>
    );
}
