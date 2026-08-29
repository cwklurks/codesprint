"use client";

import {
    Box,
    DialogBackdrop,
    DialogBody,
    DialogContent,
    DialogHeader,
    DialogPositioner,
    DialogRoot,
    DialogTitle,
    Flex,
    Grid,
    Portal,
    Text,
} from "@chakra-ui/react";
import { m } from "framer-motion";
import { useMemo, useState } from "react";
import {
    ACHIEVEMENTS,
    type AchievementCategory,
    type AchievementRarity,
} from "@/lib/achievements";
import { MOTION_DURATION, MOTION_EASE, usePrefersReducedMotion } from "@/lib/motion";
import { DialogCloseButton } from "@/components/ui/DialogCloseButton";
import {
    overlayBackdropProps,
    overlayDialogProps,
    overlayHeaderProps,
    overlayScrollAreaProps,
} from "@/components/ui/overlay";

interface AchievementGalleryProps {
    isOpen: boolean;
    onClose: () => void;
    unlockedIds: Set<string>;
}

const MotionBox = m.create(Box);

/**
 * Rarity reads off the active theme instead of four fixed hex values, so the
 * ladder stays legible (and on-brand) in every palette.
 *
 * Hue alone is not enough to separate the four: several presets derive
 * `--text-subtle` from `--accent` (minimal themes set `textSubtle` to the accent
 * at 68% alpha), so a colour-only ladder collapses to two steps on those. Each
 * tier therefore also steps up its chip -- bare text, tinted, tinted with a
 * border, then filled -- which survives any palette and both light and dark.
 */
type RarityStyle = {
    color: string;
    bg: string;
    borderColor: string;
};

export const RARITY_STYLES: Record<AchievementRarity, RarityStyle> = {
    common: {
        color: "var(--text-subtle)",
        bg: "transparent",
        borderColor: "transparent",
    },
    rare: {
        color: "var(--success)",
        bg: "color-mix(in srgb, var(--success) 14%, transparent)",
        borderColor: "transparent",
    },
    epic: {
        color: "var(--warning)",
        bg: "color-mix(in srgb, var(--warning) 16%, transparent)",
        borderColor: "color-mix(in srgb, var(--warning) 45%, transparent)",
    },
    legendary: {
        color: "var(--bg)",
        bg: "var(--accent)",
        borderColor: "var(--accent)",
    },
};

/** Long copy is clamped to a fixed two lines so neighbouring cards stay level. */
const DESCRIPTION_LINE_CLAMP = 2;

const CATEGORIES: Array<{ value: AchievementCategory | "all"; label: string }> = [
    { value: "all", label: "All" },
    { value: "speed", label: "Speed" },
    { value: "accuracy", label: "Accuracy" },
    { value: "consistency", label: "Consistency" },
    { value: "exploration", label: "Exploration" },
    { value: "milestone", label: "Milestone" },
    { value: "improvement", label: "Improvement" },
    { value: "challenge", label: "Challenge" },
    { value: "special", label: "Special" },
];

/** Cards past this index all share the last delay; a 90-card cascade is not a feature. */
const MAX_STAGGERED_CARDS = 14;

export default function AchievementGallery({ isOpen, onClose, unlockedIds }: AchievementGalleryProps) {
    const [selectedCategory, setSelectedCategory] = useState<AchievementCategory | "all">("all");
    const reducedMotion = usePrefersReducedMotion();

    const filtered = useMemo(
        () =>
            selectedCategory === "all"
                ? ACHIEVEMENTS
                : ACHIEVEMENTS.filter((a) => a.category === selectedCategory),
        [selectedCategory],
    );

    const unlockedCount = unlockedIds.size;
    const totalCount = ACHIEVEMENTS.length;
    const progress = totalCount > 0 ? unlockedCount / totalCount : 0;

    return (
        <DialogRoot
            open={isOpen}
            onOpenChange={({ open }) => {
                if (!open) onClose();
            }}
            size="xl"
            placement="center"
            scrollBehavior="inside"
        >
            <Portal>
                <DialogBackdrop {...overlayBackdropProps} />
                <DialogPositioner>
                    <DialogContent {...overlayDialogProps}>
                        <DialogCloseButton />
                        <DialogHeader {...overlayHeaderProps}>
                            <DialogTitle fontSize="xl" fontWeight="bold" color="var(--accent)">
                                Achievements
                            </DialogTitle>
                        </DialogHeader>
                        <DialogBody py={4}>
                            {/* Progress bar */}
                            <Flex align="center" gap={3} mb={5}>
                                <Text
                                    fontSize="sm"
                                    fontWeight={600}
                                    color="var(--text)"
                                    whiteSpace="nowrap"
                                    fontVariantNumeric="tabular-nums"
                                >
                                    {unlockedCount}/{totalCount} unlocked
                                </Text>
                                <Box
                                    flex={1}
                                    h="6px"
                                    bg="var(--surface-active)"
                                    boxShadow="inset 0 0 0 1px var(--border)"
                                    borderRadius="full"
                                    overflow="hidden"
                                    role="progressbar"
                                    aria-valuemin={0}
                                    aria-valuemax={totalCount}
                                    aria-valuenow={unlockedCount}
                                    aria-label="Achievements unlocked"
                                >
                                    {/* At 0% a scaled-to-nothing fill still paints a
                                        rounded hairline, which reads as a stray dash
                                        rather than an empty track. */}
                                    {progress > 0 && (
                                        <Box
                                            h="100%"
                                            w="100%"
                                            bg="var(--accent)"
                                            borderRadius="full"
                                            transformOrigin="left center"
                                            transform={`scaleX(${progress})`}
                                            transition={reducedMotion ? "none" : "transform 0.35s ease"}
                                        />
                                    )}
                                </Box>
                            </Flex>

                            {/* Category filter */}
                            <Flex
                                role="group"
                                aria-label="Filter achievements by category"
                                gap={2}
                                mb={5}
                                overflowX="auto"
                                pb={1}
                                flexWrap="wrap"
                            >
                                {CATEGORIES.map((cat) => {
                                    const active = selectedCategory === cat.value;
                                    return (
                                        <Box
                                            as="button"
                                            key={cat.value}
                                            aria-pressed={active}
                                            px={3}
                                            py={1.5}
                                            borderRadius="full"
                                            fontSize="xs"
                                            fontWeight={600}
                                            border="1px solid"
                                            borderColor={active ? "var(--border-strong)" : "var(--border)"}
                                            bg={active ? "var(--surface-active)" : "transparent"}
                                            color={active ? "var(--text)" : "var(--text-subtle)"}
                                            cursor="pointer"
                                            whiteSpace="nowrap"
                                            transition="background-color 0.18s ease, color 0.18s ease, border-color 0.18s ease"
                                            _hover={{ bg: "var(--surface-hover)", color: "var(--text)" }}
                                            onClick={() => setSelectedCategory(cat.value)}
                                        >
                                            {cat.label}
                                        </Box>
                                    );
                                })}
                            </Flex>

                            {/* Achievement grid. The grid, not the dialog body, is the
                                scroller: that keeps the progress bar and the category
                                filter in view, and gives the last row a thumb to say
                                there is more below. */}
                            <Box
                                {...overlayScrollAreaProps}
                                maxH={{ base: "46vh", md: "52vh" }}
                                pe={2}
                            >
                                <Grid
                                    templateColumns={{
                                        base: "repeat(2, 1fr)",
                                        md: "repeat(3, 1fr)",
                                        lg: "repeat(4, 1fr)",
                                    }}
                                    gap={3}
                                >
                                    {filtered.map((achievement, index) => {
                                        const unlocked = unlockedIds.has(achievement.id);
                                        const rarity = RARITY_STYLES[achievement.rarity];
                                        return (
                                            <MotionBox
                                                key={achievement.id}
                                                initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                                                animate={{ opacity: unlocked ? 1 : 0.7, y: 0 }}
                                                transition={{
                                                    duration: reducedMotion ? 0 : MOTION_DURATION.quick,
                                                    delay: reducedMotion
                                                        ? 0
                                                        : Math.min(index, MAX_STAGGERED_CARDS) * 0.02,
                                                    ease: MOTION_EASE.out,
                                                }}
                                                p={3}
                                                borderRadius="var(--radius-md)"
                                                border="1px solid var(--border)"
                                                bg="var(--surface)"
                                                boxShadow={unlocked ? "var(--elev-1)" : "none"}
                                                _hover={{
                                                    borderColor: "var(--border-strong)",
                                                    bg: "var(--surface-hover)",
                                                }}
                                            >
                                                <Flex align="center" gap={2} mb={1.5}>
                                                    {/* Only the emblem desaturates when locked.
                                                        Greying the whole card flattened the four
                                                        rarity tiers into one colour. */}
                                                    <Text
                                                        fontSize="xl"
                                                        lineHeight={1}
                                                        aria-hidden="true"
                                                        filter={unlocked ? "none" : "grayscale(1)"}
                                                        opacity={unlocked ? 1 : 0.75}
                                                    >
                                                        {achievement.icon}
                                                    </Text>
                                                    <Text
                                                        px={1.5}
                                                        py={0.5}
                                                        borderRadius="full"
                                                        border="1px solid"
                                                        fontSize="2xs"
                                                        fontWeight={700}
                                                        textTransform="uppercase"
                                                        letterSpacing="0.08em"
                                                        lineHeight={1.4}
                                                        color={rarity.color}
                                                        bg={rarity.bg}
                                                        borderColor={rarity.borderColor}
                                                    >
                                                        {achievement.rarity}
                                                    </Text>
                                                </Flex>
                                                <Text
                                                    fontSize="sm"
                                                    fontWeight={700}
                                                    color="var(--text)"
                                                    truncate
                                                    title={achievement.name}
                                                >
                                                    {achievement.name}
                                                </Text>
                                                <Text
                                                    fontSize="xs"
                                                    color="var(--text-subtle)"
                                                    lineHeight={1.4}
                                                    lineClamp={DESCRIPTION_LINE_CLAMP}
                                                    minH={`${DESCRIPTION_LINE_CLAMP * 1.4}em`}
                                                    title={achievement.description}
                                                >
                                                    {achievement.description}
                                                </Text>
                                            </MotionBox>
                                        );
                                    })}
                                </Grid>
                            </Box>
                        </DialogBody>
                    </DialogContent>
                </DialogPositioner>
            </Portal>
        </DialogRoot>
    );
}
