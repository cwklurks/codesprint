import TypingSession from "@/components/TypingSession";
import { Badge, Box, Heading, Stack, Text } from "@chakra-ui/react";

export default function HomePage() {
    return (
        <Stack gap={{ base: 10, md: 14 }} className="home-stack">
            <Box
                className="cs-hero"
                border="1px solid var(--border)"
                borderRadius="24px"
                bg="var(--panel-glass)"
                p={{ base: 5, md: 7 }}
            >
                <Stack gap={3} maxW="680px">
                    <Badge
                        alignSelf="flex-start"
                        colorScheme="yellow"
                        px={3}
                        py={1}
                        borderRadius="full"
                        fontSize="xs"
                        textTransform="uppercase"
                        letterSpacing="0.15em"
                    >
                        Deliberate practice
                    </Badge>
                    <Heading as="h1" size="2xl" lineHeight="1.1">
                        Sharpen your typing flow with production-grade snippets.
                    </Heading>
                    <Text fontSize="lg" color="var(--text-subtle)">
                        Use real Leetcode problems to practice your typing skills.
                    </Text>
                </Stack>
            </Box>
            <Box w="100%">
                <TypingSession />
            </Box>
        </Stack>
    );
}
