import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { LazyMotion, domAnimation } from "framer-motion";
import { render } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/render";
import { chakraSystem } from "@/lib/chakra-system";
import { KEYBOARD_SHORTCUTS } from "@/lib/shortcuts";
import { ACHIEVEMENTS } from "@/lib/achievements";
import ShortcutsDrawer from "@/components/ShortcutsDrawer";
import LeaderboardModal from "@/components/LeaderboardModal";
import AnalyticsModal from "@/components/AnalyticsModal";
import AchievementGallery, { RARITY_STYLES } from "@/components/AchievementGallery";
import type { LeaderboardEntry } from "@/lib/leaderboard";

const leaderboardEntries: { current: LeaderboardEntry[] } = { current: [] };

vi.mock("@/lib/leaderboard", () => ({
    getLeaderboard: () => leaderboardEntries.current,
    clearLeaderboard: () => {
        leaderboardEntries.current = [];
    },
}));

/** AchievementGallery draws through LazyMotion's strict `m` components. */
function MotionProviders({ children }: { children: ReactNode }) {
    return (
        <ChakraProvider value={chakraSystem}>
            <LazyMotion features={domAnimation} strict>
                {children}
            </LazyMotion>
        </ChakraProvider>
    );
}

describe("ShortcutsDrawer", () => {
    it("lays the shortcuts out as a two-column grid so descriptions share an x", () => {
        renderWithProviders(<ShortcutsDrawer isOpen onClose={() => {}} />);

        const chip = screen.getByText(KEYBOARD_SHORTCUTS[0].combo);
        const grid = chip.parentElement!;

        // One grid, two cells per shortcut -- not one flex row per shortcut.
        expect(grid.children).toHaveLength(KEYBOARD_SHORTCUTS.length * 2);
        for (const shortcut of KEYBOARD_SHORTCUTS) {
            expect(within(grid).getByText(shortcut.combo)).toBeInTheDocument();
            expect(within(grid).getByText(shortcut.detail)).toBeInTheDocument();
        }
    });

    it("dismisses through the one shared close control", () => {
        renderWithProviders(<ShortcutsDrawer isOpen onClose={() => {}} />);

        expect(screen.getAllByRole("button", { name: "Close" })).toHaveLength(1);
    });
});

describe("LeaderboardModal", () => {
    beforeEach(() => {
        leaderboardEntries.current = [];
    });

    it("hides the destructive clear action when there is nothing to clear", () => {
        renderWithProviders(<LeaderboardModal isOpen onOpenChange={() => {}} />);

        expect(screen.getByText("No scores yet")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Clear history" })).not.toBeInTheDocument();
    });

    it("offers the clear action once there is history", () => {
        leaderboardEntries.current = [
            { id: "a", wpm: 80, accuracy: 97, language: "python", date: "2026-01-01T00:00:00.000Z" },
        ] as LeaderboardEntry[];

        renderWithProviders(<LeaderboardModal isOpen onOpenChange={() => {}} />);

        expect(screen.getByRole("button", { name: "Clear history" })).toBeInTheDocument();
    });

    it("leaves dismissal to the header close button alone", () => {
        renderWithProviders(<LeaderboardModal isOpen onOpenChange={() => {}} />);

        expect(screen.getAllByRole("button", { name: "Close" })).toHaveLength(1);
    });
});

describe("AnalyticsModal", () => {
    it("titles the dialog once and dismisses through the shared close control", () => {
        renderWithProviders(<AnalyticsModal isOpen onOpenChange={() => {}} />);

        expect(screen.getAllByText("Analytics")).toHaveLength(1);
        expect(screen.getAllByRole("button", { name: "Close" })).toHaveLength(1);
        expect(screen.getByRole("group", { name: "Time range" })).toBeInTheDocument();
    });
});

describe("AchievementGallery", () => {
    it("gives every rarity tier its own colour and chip treatment", () => {
        const fingerprints = Object.values(RARITY_STYLES).map(
            (style) => `${style.color}|${style.bg}|${style.borderColor}`,
        );

        expect(new Set(fingerprints).size).toBe(fingerprints.length);
        expect(new Set(Object.values(RARITY_STYLES).map((style) => style.color)).size).toBe(4);
    });

    it("shows an empty track rather than a hairline at zero progress", () => {
        render(
            <MotionProviders>
                <AchievementGallery isOpen onClose={() => {}} unlockedIds={new Set()} />
            </MotionProviders>,
        );

        const bar = screen.getByRole("progressbar", { name: "Achievements unlocked" });
        expect(bar).toHaveAttribute("aria-valuenow", "0");
        expect(bar.children).toHaveLength(0);
    });

    it("draws the fill once something is unlocked", () => {
        render(
            <MotionProviders>
                <AchievementGallery
                    isOpen
                    onClose={() => {}}
                    unlockedIds={new Set([ACHIEVEMENTS[0].id])}
                />
            </MotionProviders>,
        );

        const bar = screen.getByRole("progressbar", { name: "Achievements unlocked" });
        expect(bar).toHaveAttribute("aria-valuenow", "1");
        expect(bar.children).toHaveLength(1);
    });

    it("keeps the full description reachable when the card clamps it", () => {
        render(
            <MotionProviders>
                <AchievementGallery isOpen onClose={() => {}} unlockedIds={new Set()} />
            </MotionProviders>,
        );

        const description = screen.getByText(ACHIEVEMENTS[0].description);
        expect(description).toHaveAttribute("title", ACHIEVEMENTS[0].description);
    });
});
