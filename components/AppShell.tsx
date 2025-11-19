"use client";

import Link from "next/link";
import {
    Box,
    Button,
    Container,
    Flex,
    Link as ChakraLink,
    Text,
    TooltipContent,
    TooltipPositioner,
    TooltipRoot,
    TooltipTrigger,
    chakra,
    useDisclosure,
} from "@chakra-ui/react";
import type { IconProps as ChakraIconProps } from "@chakra-ui/react";
import { ReactNode, useEffect } from "react";
import { motion } from "framer-motion";
import type { MotionProps } from "framer-motion";
import { SPRING_SMOOTH, usePrefersReducedMotion } from "@/lib/motion";
import { PreferencesProvider } from "@/lib/preferences";
import PreferencesDrawer from "@/components/PreferencesDrawer";
import ShortcutsDrawer from "@/components/ShortcutsDrawer";

export function AppShell({ children }: { children: ReactNode }) {
    const {
        open: isPreferencesOpen,
        onOpen: openPreferences,
        onClose: closePreferences,
        onToggle: togglePreferences,
    } = useDisclosure();
    const {
        open: isShortcutsOpen,
        onOpen: openShortcuts,
        onClose: closeShortcuts,
    } = useDisclosure();

    useEffect(() => {
        function handleGlobalShortcut(event: KeyboardEvent) {
            if (event.defaultPrevented) return;
            if (event.metaKey || event.ctrlKey || event.altKey) return;
            if (event.key.toLowerCase() !== "p") return;
            const target = event.target as HTMLElement | null;
            if (target?.closest("input, textarea, [contenteditable=true]")) return;
            if (document.body.classList.contains("cs-focus-active")) return;
            event.preventDefault();
            togglePreferences();
        }
        window.addEventListener("keydown", handleGlobalShortcut);
        return () => window.removeEventListener("keydown", handleGlobalShortcut);
    }, [togglePreferences]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (window.scrollY !== 0) {
            window.scrollTo({ top: 0, left: 0 });
        }
    }, []);

    return (
        <PreferencesProvider>
            <>
                <Flex direction="column" minH="100dvh" background="var(--bg-gradient)" color="var(--text)">
                    <Header onOpenPreferences={openPreferences} onOpenShortcuts={openShortcuts} />
                    <Container maxW="1280px" flex="1 1 auto" pt={8} pb={8} px={{ base: 4, lg: 10 }}>
                        {children}
                    </Container>
                </Flex>
                <PreferencesDrawer isOpen={isPreferencesOpen} onClose={closePreferences} />
                <ShortcutsDrawer isOpen={isShortcutsOpen} onClose={closeShortcuts} />
            </>
        </PreferencesProvider>
    );
}

type HeaderProps = {
    onOpenPreferences: () => void;
    onOpenShortcuts: () => void;
};

function Header({ onOpenPreferences, onOpenShortcuts }: HeaderProps) {
    const prefersReducedMotion = usePrefersReducedMotion();

    const headerMotion: MotionProps = prefersReducedMotion
        ? {}
        : {
            initial: { opacity: 0, y: -12 },
            animate: { opacity: 1, y: 0 },
            transition: { ...SPRING_SMOOTH, stiffness: 260, damping: 30 },
        };
    type IconLink =
        | { label: string; icon: ReactNode; onClick: () => void }
        | { label: string; icon: ReactNode; href: string; isExternal?: boolean };
    const iconLinks: IconLink[] = [
        { label: "Shortcuts", icon: <CommandIcon boxSize={6} />, onClick: onOpenShortcuts },
        { label: "GitHub", href: "https://github.com/", icon: <GitHubIcon boxSize={5} />, isExternal: true },
    ];

    return (
        <Box
            className="app-header"
            as="header"
            position="sticky"
            top={0}
            zIndex={30}
            color="var(--header-text)"
            bg="var(--header-bg)"
            backdropFilter="blur(18px)"
            borderBottom="1px solid var(--header-border)"
        >
            <motion.div {...headerMotion}>
                <Container maxW="1280px" px={{ base: 4, md: 8 }} py={{ base: 2.5, md: 3 }}>
                    <Flex
                        direction={{ base: "column", md: "row" }}
                        align={{ base: "flex-start", md: "center" }}
                        justify="space-between"
                        gap={{ base: 4, md: 5 }}
                    >
                        <Flex align="center" gap={4} flexWrap="wrap">
                            <Link href="/" aria-label="CodeSprint home">
                                <Text fontWeight={700} fontSize={{ base: "2xl", md: "3xl" }} letterSpacing="0.3px">
                                    codesprint<span style={{ color: "var(--accent)" }}>.dev</span>
                                </Text>
                            </Link>
                            <Text
                                fontSize={{ base: "xs", md: "sm" }}
                                color="var(--header-text-subtle)"
                                textTransform="uppercase"
                                letterSpacing="0.28em"
                            >
                                Focused typing drills for engineers
                            </Text>
                        </Flex>
                        <Flex
                            align="center"
                            justify={{ base: "flex-start", md: "flex-end" }}
                            gap={2}
                            flexWrap="wrap"
                            flex="1 1 auto"
                            w={{ base: "100%", md: "auto" }}
                        >
                            <Flex gap={2} align="center" flexWrap="wrap">
                                {iconLinks.map((item) => {
                                    const linkStyles = {
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        w: 11,
                                        h: 11,
                                        borderRadius: "full",
                                        border: "1px solid var(--header-border)",
                                        bg: "rgba(255, 255, 255, 0.06)",
                                        color: "var(--header-text)",
                                        transition:
                                            "transform 0.18s ease, background 0.18s ease, color 0.18s ease, border-color 0.18s ease",
                                        transform: "translateY(0)",
                                        _hover: {
                                            bg: "var(--surface)",
                                            color: "var(--header-text)",
                                            borderColor: "var(--header-text)",
                                            transform: "translateY(-2px)",
                                        },
                                        _active: { bg: "var(--surface-active)", transform: "scale(0.96)" },
                                        _focusVisible: { boxShadow: "0 0 0 2px var(--focus-ring)" },
                                    } as const;

                                    const trigger =
                                        "href" in item
                                            ? item.isExternal
                                                ? (
                                                    <ChakraLink
                                                        href={item.href}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        aria-label={item.label}
                                                        {...linkStyles}
                                                    >
                                                        {item.icon}
                                                    </ChakraLink>
                                                )
                                                : (
                                                    <ChakraLink
                                                        as={Link}
                                                        href={item.href}
                                                        aria-label={item.label}
                                                        {...linkStyles}
                                                    >
                                                        {item.icon}
                                                    </ChakraLink>
                                                )
                                            : (
                                                <chakra.button
                                                    type="button"
                                                    aria-label={item.label}
                                                    onClick={item.onClick}
                                                    {...linkStyles}
                                                >
                                                    {item.icon}
                                                </chakra.button>
                                            );

                                    return (
                                        <TooltipRoot key={item.label}>
                                            <TooltipTrigger asChild>{trigger}</TooltipTrigger>
                                            <TooltipPositioner>
                                                <TooltipContent
                                                    px={2}
                                                    py={1}
                                                    borderRadius="sm"
                                                    bg="var(--surface)"
                                                    color="var(--header-text)"
                                                    border="1px solid var(--border)"
                                                    fontSize="xs"
                                                >
                                                    {item.label}
                                                </TooltipContent>
                                            </TooltipPositioner>
                                        </TooltipRoot>
                                    );
                                })}
                            </Flex>
                            <Button
                                size="md"
                                borderRadius="full"
                                px={5}
                                py={3}
                                variant="outline"
                                borderColor="var(--border)"
                                color="var(--header-text)"
                                bg="transparent"
                                fontSize="sm"
                                _hover={{ borderColor: "var(--border-strong)", bg: "var(--surface)" }}
                                _active={{ borderColor: "var(--border-strong)", bg: "var(--surface-active)" }}
                                onClick={onOpenPreferences}
                            >
                                Preferences
                            </Button>
                        </Flex>
                    </Flex>
                </Container>
            </motion.div>
        </Box>
    );
}

export default AppShell;

function CommandIcon(props: ChakraIconProps) {
    return (
        <chakra.svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            {...props}
        >
            <path d="M13 5L8.5 13h4.5l-1.5 6 6-8.5h-4.5l1.5-5z" />
        </chakra.svg>
    );
}

function GitHubIcon(props: ChakraIconProps) {
    return (
        <chakra.svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...props}>
            <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.71c-2.78.61-3.37-1.34-3.37-1.34-.46-1.17-1.12-1.48-1.12-1.48-.91-.62.07-.61.07-.61 1 .07 1.53 1.05 1.53 1.05.9 1.53 2.36 1.09 2.94.84.09-.66.35-1.1.63-1.35-2.22-.26-4.56-1.11-4.56-4.95a3.88 3.88 0 0 1 1-2.68 3.6 3.6 0 0 1 .1-2.65s.84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02a3.6 3.6 0 0 1 .1 2.65 3.88 3.88 0 0 1 1 2.68c0 3.85-2.34 4.68-4.57 4.94.36.31.67.92.67 1.86v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2z" />
        </chakra.svg>
    );
}
