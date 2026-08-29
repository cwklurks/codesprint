"use client";

import { useEffect, useState } from "react";
import { Box, Flex, Text } from "@chakra-ui/react";

/** Languages shipped in `data/snippets-*.json`. */
const LANGUAGE_COUNT = 4;
/** Rounded size of that corpus (896 snippets at the time of writing). */
const SNIPPET_COUNT_LABEL = "~900 snippets";

/**
 * The compact strip above the control bar. The sticky header already carries the
 * wordmark and the daily card already sits between here and the editor, so this
 * is deliberately two lines of type — anything taller pushes the editor below
 * the fold on a 13" laptop.
 */
export function Hero() {
    const [bestWpm, setBestWpm] = useState<number | null>(null);

    useEffect(() => {
        let cancelled = false;
        let detach = () => {};
        // The module stays dynamically imported (it drags IndexedDB helpers in),
        // so the event name is read off the resolved module rather than
        // duplicated here — one source of truth, still nothing in first load.
        import("@/lib/storage/session-history")
            .then((mod) => {
                if (cancelled) return;
                const refresh = () => {
                    mod.getSessionStatsAsync()
                        .then((stats) => {
                            if (!cancelled) setBestWpm(Math.round(stats.bestWpm));
                        })
                        .catch((err) => {
                            console.warn("Failed to load personal best:", err);
                        });
                };
                // A finished run writes its record while this strip is mounted
                // (just hidden), so without this the line still reads "no runs
                // yet" when the user lands back on the session.
                window.addEventListener(mod.SESSION_SAVED_EVENT, refresh);
                detach = () => window.removeEventListener(mod.SESSION_SAVED_EVENT, refresh);
                refresh();
            })
            .catch((err) => {
                // Decorative stat only — a storage-less browser just gets a shorter line.
                console.warn("Failed to load personal best:", err);
            });
        return () => {
            cancelled = true;
            detach();
        };
    }, []);

    const stats = [
        `${LANGUAGE_COUNT} languages`,
        SNIPPET_COUNT_LABEL,
        bestWpm === null ? null : bestWpm > 0 ? `best ${bestWpm} wpm` : "no runs yet",
    ].filter((entry): entry is string => entry !== null);

    return (
        <Box as="section" className="hero-panel" aria-label="About CodeSprint">
            <Text as="p" fontSize={{ base: "sm", md: "md" }} color="var(--text)" lineHeight={1.5} maxW="76ch">
                Type real source code and get faster at the syntax you actually write.
            </Text>
            <Flex
                as="p"
                mt={1.5}
                align="center"
                gap={2}
                flexWrap="wrap"
                fontSize="xs"
                color="var(--text-subtle)"
                letterSpacing="0.06em"
                fontVariantNumeric="tabular-nums"
            >
                {stats.map((entry, index) => (
                    <Flex as="span" key={entry} align="center" gap={2}>
                        {index > 0 && (
                            <Text as="span" aria-hidden="true" opacity={0.55}>
                                ·
                            </Text>
                        )}
                        {entry}
                    </Flex>
                ))}
            </Flex>
        </Box>
    );
}

export default Hero;
