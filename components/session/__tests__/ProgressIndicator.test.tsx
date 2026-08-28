import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderWithProviders as render } from "@/test-utils/render";
import { ProgressIndicator } from "../ProgressIndicator";
import { SessionTopBar } from "../SessionTopBar";

const baseProps = {
    progress: 0.4,
    isTerminalMode: false,
    isImmersive: false,
    showChrome: true,
    prefersReducedMotion: true,
};

describe("ProgressIndicator", () => {
    it("keeps the immersive rail on screen after the chrome hides for a run", () => {
        const { container } = render(
            <ProgressIndicator {...baseProps} isImmersive showChrome={false} />,
        );
        const rail = container.querySelector("[role='progressbar']");
        expect(rail).toBeTruthy();
        expect(rail?.getAttribute("aria-valuenow")).toBe("40");
    });

    it("renders nothing in framed mode once the chrome hides", () => {
        const { container } = render(<ProgressIndicator {...baseProps} showChrome={false} />);
        expect(container.firstChild).toBeNull();
    });

    it("fills the framed bar with a solid accent rather than a fade-out gradient", () => {
        const { container } = render(<ProgressIndicator {...baseProps} />);
        expect(container.querySelector("div > div")).toBeTruthy();
        // jsdom drops `background: var(--accent)` but keeps a literal gradient, so
        // the absence of one is the assertable half.
        expect(container.innerHTML).not.toContain("gradient");
    });

    it("keeps the ASCII bar in terminal mode", () => {
        const { container } = render(
            <ProgressIndicator {...baseProps} isTerminalMode isImmersive />,
        );
        expect(container.textContent).toContain("40%");
        expect(container.querySelector("[role='progressbar']")).toBeNull();
    });
});

describe("SessionTopBar focus-mode chrome", () => {
    const topBarProps = {
        ...baseProps,
        currentProblem: null,
        problemCount: 4,
        onNextProblem: vi.fn(),
        onLeaderboardOpen: vi.fn(),
    };

    it("hides both actions during a run", () => {
        const { queryByText } = render(<SessionTopBar {...topBarProps} showChrome={false} />);
        expect(queryByText("Leaderboard")).toBeNull();
        expect(queryByText("Next problem")).toBeNull();
    });

    it("still renders the immersive rail while the chrome is down", () => {
        const { container } = render(
            <SessionTopBar {...topBarProps} isImmersive showChrome={false} />,
        );
        expect(container.querySelector("[role='progressbar']")).toBeTruthy();
    });

    it("shows the actions again once the run ends", () => {
        const { queryByText } = render(<SessionTopBar {...topBarProps} />);
        expect(queryByText("Leaderboard")).toBeTruthy();
        expect(queryByText("Next problem")).toBeTruthy();
    });
});
