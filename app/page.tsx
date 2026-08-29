import TypingSession from "@/components/TypingSession";
import { Hero } from "@/components/Hero";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Box } from "@chakra-ui/react";

// Title and description come from the root layout — the home page is the site,
// so a page-level override would only get the "%s · CodeSprint" template
// appended to a string that already names the product.

export default function HomePage() {
    return (
        <Box className="home-stack" w="100%">
            <Hero />
            <ErrorBoundary>
                <TypingSession />
            </ErrorBoundary>
        </Box>
    );
}
