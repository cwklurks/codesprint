import type { Metadata } from "next";
import TypingSession from "@/components/TypingSession";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Box } from "@chakra-ui/react";

export const metadata: Metadata = {
    title: "CodeSprint — typing trainer for code",
    description:
        "Practice typing real source code with Monaco. Track WPM, accuracy, and weak patterns across languages, with AI-generated drills targeting your weakest tokens.",
};

export default function HomePage() {
    return (
        <Box w="100%">
            <ErrorBoundary>
                <TypingSession />
            </ErrorBoundary>
        </Box>
    );
}
