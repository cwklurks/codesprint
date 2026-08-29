"use client";

import { memo } from "react";
import { Button, Flex, Text } from "@chakra-ui/react";
import {
    TooltipContent,
    TooltipPositioner,
    TooltipRoot,
    TooltipTrigger,
} from "@chakra-ui/react";
import { ProgressIndicator, type ProgressIndicatorProps } from "./ProgressIndicator";
import { getNextProblemButtonStyles } from "@/lib/session-styles";
import type { Problem } from "@/lib/snippets";

export interface SessionTopBarProps extends ProgressIndicatorProps {
    /** Current problem being practiced (null if none) */
    currentProblem: Problem | null;
    /** Total number of problems available */
    problemCount: number;
    /** Callback when next problem button is clicked */
    onNextProblem: () => void;
    /** Callback when leaderboard button is clicked */
    onLeaderboardOpen: () => void;
}

/**
 * Top bar containing progress indicator, problem summary, and action buttons
 */
function SessionTopBarImpl({
    progress,
    isTerminalMode,
    isImmersive,
    showChrome,
    prefersReducedMotion,
    currentProblem,
    problemCount,
    onNextProblem,
    onLeaderboardOpen,
}: SessionTopBarProps) {
    const nextProblemButtonStyles = getNextProblemButtonStyles(isTerminalMode);

    // Problem summary
    const problemSummary =
        problemCount > 0 ? (
            <Flex direction="column" gap={1} minW={0}>
                <Text fontSize="sm" fontWeight={600} color="var(--text)" whiteSpace="nowrap" fontVariantNumeric="tabular-nums">
                    {problemCount} {problemCount === 1 ? "problem" : "problems"}
                </Text>
                <Text
                    fontSize="xs"
                    color="var(--text-subtle)"
                    whiteSpace="nowrap"
                    textOverflow="ellipsis"
                    overflow="hidden"
                >
                    Now practicing: {currentProblem ? currentProblem.title : "Random snippet"}
                </Text>
            </Flex>
        ) : (
            <Text fontSize="sm" fontWeight={600} color="var(--text)">
                No problems available
            </Text>
        );

    // Next problem button (only if multiple problems)
    const nextProblemButton =
        problemCount > 1 ? (
            <TooltipRoot>
                <TooltipTrigger asChild>
                    <Button onClick={onNextProblem} {...nextProblemButtonStyles}>
                        Next problem
                    </Button>
                </TooltipTrigger>
                <TooltipPositioner>
                    <TooltipContent
                        bg="var(--surface)"
                        color="var(--text)"
                        border="1px solid var(--border)"
                        fontSize="xs"
                        px={2}
                        py={1}
                    >
                        Press N or Q
                    </TooltipContent>
                </TooltipPositioner>
            </TooltipRoot>
        ) : null;

    const progressIndicator = (
        <ProgressIndicator
            progress={progress}
            isTerminalMode={isTerminalMode}
            isImmersive={isImmersive}
            showChrome={showChrome}
            prefersReducedMotion={prefersReducedMotion}
        />
    );

    // Chrome is hidden for the whole run, so both halves have to stand down —
    // otherwise Leaderboard and Next problem stay lit while the editor is meant
    // to be the only thing on screen.
    const hasMeta = showChrome;
    const hasActions = showChrome && Boolean(nextProblemButton);

    // The immersive run indicator is pinned to the viewport, not to this row, so
    // it keeps rendering after the chrome has gone.
    if (!hasMeta && !hasActions) return progressIndicator;

    return (
        <Flex
            align="center"
            justify={hasMeta && hasActions ? "space-between" : "flex-start"}
            gap={3}
            flexWrap="wrap"
        >
            {hasMeta && (
                <Flex align="center" gap={3} flexWrap="wrap">
                    {progressIndicator}
                    {problemSummary}
                </Flex>
            )}
            {hasActions && (
                <Flex align="center" gap={2} flexWrap="wrap" ml={hasMeta ? undefined : "auto"}>
                    <Button
                        size="sm"
                        variant="ghost"
                        color="var(--text-subtle)"
                        _hover={{ color: "var(--accent)", bg: "var(--surface-hover)" }}
                        onClick={onLeaderboardOpen}
                    >
                        Leaderboard
                    </Button>
                    {nextProblemButton}
                </Flex>
            )}
        </Flex>
    );
}

export const SessionTopBar = memo(SessionTopBarImpl);
