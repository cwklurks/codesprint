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
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { LazyMotion, domAnimation, m } from "framer-motion";
import type { MotionProps } from "framer-motion";
import dynamic from "next/dynamic";
import { MOTION_DURATION, SPRING_SMOOTH, usePrefersReducedMotion } from "@/lib/motion";
import { PreferencesProvider } from "@/lib/preferences";
import { runMigrations } from "@/lib/storage/migration";
import { getMetaValue } from "@/lib/storage/idb-store";
import { idbGetAll, STORES, type AchievementRecord } from "@/lib/storage/idb-store";
import { computeLevelFromXp } from "@/lib/xp";
import type { StreakState } from "@/lib/streaks";

// Overlay panels are opened by user action only — keep them (and the Chakra
// dialog machinery they pull in) out of the first-load bundle.
const PreferencesDrawer = dynamic(() => import("@/components/PreferencesDrawer"), { ssr: false });
const ShortcutsDrawer = dynamic(() => import("@/components/ShortcutsDrawer"), { ssr: false });
const AnalyticsModal = dynamic(() => import("@/components/AnalyticsModal"), { ssr: false });
const AchievementGallery = dynamic(() => import("@/components/AchievementGallery"), { ssr: false });

type OverlayStateValue = {
    /** True while ANY dialog/drawer in the app is open. */
    isOverlayOpen: boolean;
    /** Register/unregister an overlay by a stable id. */
    setOverlayOpen: (id: string, open: boolean) => void;
};

const OverlayStateContext = createContext<OverlayStateValue>({
    isOverlayOpen: false,
    setOverlayOpen: () => {},
});

/**
 * Central "a dialog owns the keyboard" gate. Overlay state is spread across
 * AppShell (preferences/shortcuts/analytics/gallery) and TypingSession
 * (leaderboard/AI drills); the typing engine's capture-phase key handler needs a
 * single answer, otherwise keys meant for an open dialog reach the engine.
 */
export function useOverlayState(): OverlayStateValue {
    return useContext(OverlayStateContext);
}

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

/** One timing for every header affordance, taken from the motion scale. */
const HEADER_CONTROL_TRANSITION = [
    `transform ${MOTION_DURATION.quick}s ease`,
    `background-color ${MOTION_DURATION.quick}s ease`,
    `color ${MOTION_DURATION.quick}s ease`,
    `border-color ${MOTION_DURATION.quick}s ease`,
].join(", ");

/**
 * First focusable element on the page: hidden until it is tabbed to, then it
 * jumps the keyboard past the header straight into the session.
 */
function SkipToContentLink() {
    return (
        <ChakraLink
            href="#main"
            position="fixed"
            top={3}
            left={4}
            zIndex={100}
            px={3}
            py={2}
            borderRadius="var(--radius-sm)"
            // Opaque, not the translucent --surface: over the sticky header the
            // wordmark used to read through the link ("codesprint" as
            // "...esprint"). The elevation keeps it reading as a layer above.
            bg="var(--bg)"
            color="var(--text)"
            border="1px solid var(--border-strong)"
            boxShadow="var(--elev-3)"
            fontSize="sm"
            fontWeight={600}
            whiteSpace="nowrap"
            textDecoration="none"
            transform="translateY(calc(-100% - 16px))"
            transition={HEADER_CONTROL_TRANSITION}
            _focusVisible={{ transform: "translateY(0)" }}
            _focus={{ transform: "translateY(0)" }}
        >
            Skip to content
        </ChakraLink>
    );
}

export function AppShell({ children }: { children: ReactNode }) {
    const [activeModal, setActiveModal] = useState<ActiveModal>(null);
    const [externalOverlays, setExternalOverlays] = useState<ReadonlySet<string>>(() => new Set());
    const progressSummary = useProgressSummary();

    const setOverlayOpen = useCallback((id: string, open: boolean) => {
        setExternalOverlays((prev) => {
            if (open === prev.has(id)) return prev;
            const next = new Set(prev);
            if (open) next.add(id);
            else next.delete(id);
            return next;
        });
    }, []);

    const overlayState = useMemo<OverlayStateValue>(
        () => ({ isOverlayOpen: activeModal !== null || externalOverlays.size > 0, setOverlayOpen }),
        [activeModal, externalOverlays, setOverlayOpen],
    );

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
            // A dialog owned by the session (leaderboard, AI drill) has the
            // keyboard: the session's capture handler stands down for it without
            // stopping propagation, so without this p/a would open Preferences or
            // Analytics on top of it. `activeModal` is a single slot and cannot
            // stack, so p-to-close still works.
            if (externalOverlays.size > 0) return;
            // Cheap class check first — the DOM ancestor walk below is the expensive
            // half and runs on every keystroke of a session otherwise.
            if (document.body.classList.contains("cs-focus-active")) return;
            const target = event.target as HTMLElement | null;
            if (target?.closest("input, textarea, [contenteditable=true]")) return;
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
    }, [toggle, externalOverlays]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (window.scrollY !== 0) {
            window.scrollTo({ top: 0, left: 0 });
        }
    }, []);

    return (
        <PreferencesProvider>
            <LazyMotion features={domAnimation} strict>
                <OverlayStateContext.Provider value={overlayState}>
                {/* body already paints --bg-gradient (app/globals.css); a second
                    full-height layer here just doubles the paint. */}
                <Flex direction="column" minH="100dvh" color="var(--text)">
                    <SkipToContentLink />
                    <Header
                        onOpenPreferences={() => setActiveModal("preferences")}
                        onOpenShortcuts={() => setActiveModal("shortcuts")}
                        onOpenAnalytics={() => setActiveModal("analytics")}
                        onOpenGallery={() => setActiveModal("gallery")}
                        progressSummary={progressSummary}
                    />
                    <Container as="main" id="main" maxW="1280px" flex="1 1 auto" pt={{ base: 5, md: 8 }} pb={8} px={{ base: 4, lg: 10 }}>
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
                </OverlayStateContext.Provider>
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
                <Container maxW="1280px" px={{ base: 4, md: 8 }} py={{ base: 2, md: 3 }}>
                    {/* One row at every width. Stacked, this header ate 165px of a
                        390x844 screen and pushed the editor clean below the fold,
                        so on phones the wordmark shrinks, the level meter stands
                        down and Preferences collapses to its icon. */}
                    <Flex
                        direction="row"
                        align="center"
                        justify="space-between"
                        gap={{ base: 2, md: 5 }}
                        flexWrap="wrap"
                    >
                        <Flex align="center" gap={4} flexShrink={0}>
                            <Link href="/" aria-label="CodeSprint home">
                                {/* The single h1 for the app: the home hero deliberately
                                    does not repeat the wordmark. */}
                                <Text as="h1" fontWeight={700} fontSize={{ base: "lg", sm: "xl", md: "3xl" }} letterSpacing="0.3px">
                                    codesprint
                                </Text>
                            </Link>
                        </Flex>
                        <Flex
                            align="center"
                            justify="flex-end"
                            gap={{ base: 1.5, md: 2 }}
                            flexWrap="nowrap"
                            flex="0 1 auto"
                            minW={0}
                        >
                            {progressSummary && (
                                <Flex align="center" gap={3} mr={{ base: 0.5, md: 2 }} flexShrink={0}>
                                    {progressSummary.streak >= 1 && (
                                        <Flex
                                            align="center"
                                            gap={1}
                                            role="img"
                                            aria-label={`${progressSummary.streak} day streak`}
                                            title={`${progressSummary.streak} day streak`}
                                        >
                                            <FlameIcon boxSize={3.5} color="var(--accent)" />
                                            <Text
                                                aria-hidden="true"
                                                fontSize="sm"
                                                fontWeight={600}
                                                color="var(--header-text)"
                                                fontVariantNumeric="tabular-nums"
                                            >
                                                {progressSummary.streak}
                                            </Text>
                                        </Flex>
                                    )}
                                    {levelInfo && (
                                        // The level meter is the first thing to go on a
                                        // phone: it is ambient, and the row has to fit.
                                        <Flex align="center" gap={2} display={{ base: "none", md: "flex" }}>
                                            <Text fontSize="xs" fontWeight={700} color="var(--accent)">
                                                Lv.{levelInfo.level}
                                            </Text>
                                            <Box
                                                w="40px"
                                                h="4px"
                                                bg="var(--surface)"
                                                // Inset ring, not a border: a real border would
                                                // eat half of a 4px rail (same reason the slider
                                                // recipe uses one). It is what makes an empty
                                                // track read as a track.
                                                boxShadow="inset 0 0 0 1px var(--border)"
                                                borderRadius="full"
                                                overflow="hidden"
                                            >
                                                {/* scaleX rather than width: a compositor-only
                                                    transition, no layout on every XP change.
                                                    Skipped entirely at 0 — a zero-width rounded
                                                    fill still paints a stray hairline. */}
                                                {levelInfo.progress > 0 && (
                                                    <Box
                                                        h="100%"
                                                        w="100%"
                                                        bg="var(--accent)"
                                                        borderRadius="full"
                                                        transform={`scaleX(${levelInfo.progress})`}
                                                        transformOrigin="0% 50%"
                                                        transition={`transform ${MOTION_DURATION.base}s ease`}
                                                    />
                                                )}
                                            </Box>
                                        </Flex>
                                    )}
                                </Flex>
                            )}
                            <Flex gap={{ base: 1, md: 2 }} align="center" flexWrap="nowrap" flexShrink={0}>
                                {iconLinks.map((item) => {
                                    const linkStyles = {
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        flexShrink: 0,
                                        w: { base: 9, md: 11 },
                                        h: { base: 9, md: 11 },
                                        borderRadius: "full",
                                        border: "1px solid var(--header-border)",
                                        bg: "var(--surface)",
                                        color: "var(--header-text)",
                                        transition: HEADER_CONTROL_TRANSITION,
                                        transform: "translateY(0)",
                                        _hover: {
                                            bg: "var(--surface-hover)",
                                            color: "var(--header-text)",
                                            borderColor: "var(--border-strong)",
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
                                                    borderRadius="var(--radius-sm)"
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
                                aria-label="Preferences"
                                size="md"
                                borderRadius="full"
                                px={{ base: 0, md: 5 }}
                                // Squares up with the icon buttons beside it at
                                // both sizes (36px on phones, 44px from md).
                                w={{ base: 9, md: "auto" }}
                                h={{ base: 9, md: 11 }}
                                minW={{ base: 9, md: "auto" }}
                                flexShrink={0}
                                variant="outline"
                                borderColor="var(--border)"
                                color="var(--header-text)"
                                bg="transparent"
                                fontSize="sm"
                                transition={HEADER_CONTROL_TRANSITION}
                                _hover={{ borderColor: "var(--border-strong)", bg: "var(--surface-hover)" }}
                                _active={{ borderColor: "var(--border-strong)", bg: "var(--surface-active)" }}
                                onClick={onOpenPreferences}
                            >
                                {/* Label on desktop, icon on phones — the aria-label
                                    keeps the accessible name "Preferences" either way. */}
                                <Box as="span" display={{ base: "none", md: "inline" }}>
                                    Preferences
                                </Box>
                                <SlidersIcon boxSize={5} display={{ base: "block", md: "none" }} />
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

function SlidersIcon(props: ChakraIconProps) {
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
            <line x1="4" y1="8" x2="20" y2="8" />
            <line x1="4" y1="16" x2="20" y2="16" />
            <circle cx="10" cy="8" r="2.4" />
            <circle cx="15" cy="16" r="2.4" />
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

function FlameIcon(props: ChakraIconProps) {
    return (
        <chakra.svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            {...props}
        >
            <path d="M12 2c.6 3.2 2.4 4.4 3.9 6A7.4 7.4 0 0 1 18 13a6 6 0 0 1-12 0c0-1.9.9-3.4 1.8-4.4.2 1 .8 1.8 1.7 2.1-.2-2.9.9-6.5 2.5-8.7z" />
            <path d="M12 20a3 3 0 0 1-1.6-5.5c.3 1 1 1.5 1.6 1.7.6-.9.9-2 .8-3 1.4 1 2.2 2.4 2.2 3.8A3 3 0 0 1 12 20z" />
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
