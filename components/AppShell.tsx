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
} from "@chakra-ui/react";
import type { IconProps as ChakraIconProps } from "@chakra-ui/react";
import { ReactNode, useCallback, useEffect, useState } from "react";
import { LazyMotion, domAnimation, m } from "framer-motion";
import type { MotionProps } from "framer-motion";
import { SPRING_SMOOTH, usePrefersReducedMotion } from "@/lib/motion";
import { PreferencesProvider } from "@/lib/preferences";
import PreferencesDrawer from "@/components/PreferencesDrawer";
import ShortcutsDrawer from "@/components/ShortcutsDrawer";
import AnalyticsModal from "@/components/AnalyticsModal";
import AchievementGallery from "@/components/AchievementGallery";
import { runMigrations } from "@/lib/storage/migration";
import { getMetaValue } from "@/lib/storage/idb-store";
import { idbGetAll, STORES, type AchievementRecord } from "@/lib/storage/idb-store";
import { computeLevelFromXp } from "@/lib/xp";
import type { StreakState } from "@/lib/streaks";

function useProgressSummary() {
    const [data, setData] = useState<{ totalXp: number; streak: number; unlockedIds: Set<string> } | null>(null);
    useEffect(() => {
        Promise.all([
            getMetaValue<number>("totalXp"),
            getMetaValue<StreakState>("streak"),
            idbGetAll<AchievementRecord>(STORES.achievements),
        ]).then(([xp, streakState, achievements]) => {
            setData({
                totalXp: xp ?? 0,
                streak: streakState?.currentStreak ?? 0,
                unlockedIds: new Set(achievements.map((a) => a.id)),
            });
        }).catch((err) => {
            console.warn("Failed to load progress summary:", err);
        });
    }, []);
    return data;
}

type ActiveModal = "preferences" | "shortcuts" | "analytics" | "gallery" | null;

export function AppShell({ children }: { children: ReactNode }) {
    const [activeModal, setActiveModal] = useState<ActiveModal>(null);
    const progressSummary = useProgressSummary();

    useEffect(() => {
        runMigrations().catch((err) => {
            console.warn("Migration failed:", err);
        });
    }, []);

    const close = useCallback(() => setActiveModal(null), []);
    const toggle = useCallback(
        (modal: NonNullable<ActiveModal>) =>
            setActiveModal((prev) => (prev === modal ? null : modal)),
        [],
    );

    useEffect(() => {
        function handleGlobalShortcut(event: KeyboardEvent) {
            if (event.defaultPrevented) return;
            if (event.metaKey || event.ctrlKey || event.altKey) return;
            const target = event.target as HTMLElement | null;
            if (target?.closest("input, textarea, [contenteditable=true]")) return;
            if (document.body.classList.contains("cs-focus-active")) return;
            // If a dialog/drawer overlay is open, don't toggle app drawers via shortcut
            // (the overlay will handle Escape to close itself).
            if (
                document.querySelector('[data-scope="dialog"][data-state="open"], [data-scope="drawer"][data-state="open"]')
            ) {
                return;
            }
            const key = event.key.toLowerCase();
            if (key === "p") {
                event.preventDefault();
                toggle("preferences");
            } else if (key === "a") {
                event.preventDefault();
                toggle("analytics");
            }
        }
        window.addEventListener("keydown", handleGlobalShortcut);
        return () => window.removeEventListener("keydown", handleGlobalShortcut);
    }, [toggle]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (window.scrollY !== 0) {
            window.scrollTo({ top: 0, left: 0 });
        }
    }, []);

    return (
        <PreferencesProvider>
            <LazyMotion features={domAnimation} strict>
                <Flex direction="column" minH="100dvh" background="var(--bg-gradient)" color="var(--text)">
                    <Header
                        onOpenPreferences={() => setActiveModal("preferences")}
                        onOpenShortcuts={() => setActiveModal("shortcuts")}
                        onOpenAnalytics={() => setActiveModal("analytics")}
                        onOpenGallery={() => setActiveModal("gallery")}
                        progressSummary={progressSummary}
                    />
                    <Container maxW="1280px" flex="1 1 auto" pt={8} pb={8} px={{ base: 4, lg: 10 }}>
                        {children}
                    </Container>
                </Flex>
                {activeModal === "preferences" && <PreferencesDrawer isOpen onClose={close} />}
                {activeModal === "shortcuts" && <ShortcutsDrawer isOpen onClose={close} />}
                {activeModal === "analytics" && <AnalyticsModal isOpen onOpenChange={({ open }) => { if (!open) close(); }} />}
                {activeModal === "gallery" && (
                    <AchievementGallery
                        isOpen
                        onClose={close}
                        unlockedIds={progressSummary?.unlockedIds ?? new Set()}
                    />
                )}
            </LazyMotion>
        </PreferencesProvider>
    );
}

type HeaderProps = {
    onOpenPreferences: () => void;
    onOpenShortcuts: () => void;
    onOpenAnalytics: () => void;
    onOpenGallery: () => void;
    progressSummary: { totalXp: number; streak: number; unlockedIds: Set<string> } | null;
};

function Header({ onOpenPreferences, onOpenShortcuts, onOpenAnalytics, onOpenGallery, progressSummary }: HeaderProps) {
    const prefersReducedMotion = usePrefersReducedMotion();

    const headerMotion: MotionProps = prefersReducedMotion
        ? {}
        : {
            initial: { opacity: 0, y: -12 },
            animate: { opacity: 1, y: 0 },
            transition: { ...SPRING_SMOOTH, stiffness: 260, damping: 30 },
        };
    const levelInfo = progressSummary ? computeLevelFromXp(progressSummary.totalXp) : null;

    type IconLink =
        | { label: string; icon: ReactNode; onClick: () => void }
        | { label: string; icon: ReactNode; href: string; isExternal?: boolean };
    const iconLinks: IconLink[] = [
        { label: "Achievements", icon: <TrophyIcon boxSize={5} />, onClick: onOpenGallery },
        { label: "Analytics (A)", icon: <AnalyticsIcon boxSize={5} />, onClick: onOpenAnalytics },
        { label: "Shortcuts", icon: <CommandIcon boxSize={6} />, onClick: onOpenShortcuts },
        { label: "GitHub", href: "https://github.com/cwklurks/codesprint", icon: <GitHubIcon boxSize={5} />, isExternal: true },
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
            <m.div {...headerMotion}>
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
                                    codesprint
                                </Text>
                            </Link>
                        </Flex>
                        <Flex
                            align="center"
                            justify={{ base: "flex-start", md: "flex-end" }}
                            gap={2}
                            flexWrap="wrap"
                            flex="1 1 auto"
                            w={{ base: "100%", md: "auto" }}
                        >
                            {progressSummary && (
                                <Flex align="center" gap={3} mr={2}>
                                    {progressSummary.streak >= 1 && (
                                        <Flex align="center" gap={1}>
                                            <Text fontSize="sm" lineHeight={1}>🔥</Text>
                                            <Text fontSize="sm" fontWeight={600} color="var(--header-text)">
                                                {progressSummary.streak}
                                            </Text>
                                        </Flex>
                                    )}
                                    {levelInfo && (
                                        <Flex align="center" gap={2}>
                                            <Text fontSize="xs" fontWeight={700} color="var(--accent)">
                                                Lv.{levelInfo.level}
                                            </Text>
                                            <Box w="40px" h="4px" bg="var(--surface)" borderRadius="full" overflow="hidden">
                                                <Box
                                                    h="100%"
                                                    w={`${levelInfo.progress * 100}%`}
                                                    bg="var(--accent)"
                                                    borderRadius="full"
                                                    transition="width 0.3s ease"
                                                />
                                            </Box>
                                        </Flex>
                                    )}
                                </Flex>
                            )}
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
            </m.div>
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

function AnalyticsIcon(props: ChakraIconProps) {
    return (
        <chakra.svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            {...props}
        >
            <line x1="8" y1="18" x2="8" y2="12" />
            <line x1="12" y1="18" x2="12" y2="4" />
            <line x1="16" y1="18" x2="16" y2="10" />
        </chakra.svg>
    );
}

function TrophyIcon(props: ChakraIconProps) {
    return (
        <chakra.svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            {...props}
        >
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
            <path d="M4 22h16" />
            <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
            <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
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
