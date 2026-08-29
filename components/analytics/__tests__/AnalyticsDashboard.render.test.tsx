import { describe, it, expect, beforeEach } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders as render } from "@/test-utils/render";
import AnalyticsDashboard, { TIME_RANGE_OPTIONS } from "@/components/analytics/AnalyticsDashboard";

describe("AnalyticsDashboard chrome", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("offers the time range as a themed segmented control, not a native select", () => {
        render(<AnalyticsDashboard />);

        expect(screen.getByRole("group", { name: "Time range" })).toBeInTheDocument();
        expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    });

    it("renders one pressable segment per range with the week preselected", () => {
        render(<AnalyticsDashboard />);

        const group = screen.getByRole("group", { name: "Time range" });
        const segments = Array.from(group.querySelectorAll("button"));
        expect(segments.map((button) => button.textContent)).toEqual(
            TIME_RANGE_OPTIONS.map((option) => option.label),
        );
        expect(screen.getByRole("button", { name: "Week" })).toHaveAttribute("aria-pressed", "true");
    });

    it("moves the pressed state to whichever range is clicked", () => {
        render(<AnalyticsDashboard />);

        fireEvent.click(screen.getByRole("button", { name: "All time" }));

        expect(screen.getByRole("button", { name: "All time" })).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByRole("button", { name: "Week" })).toHaveAttribute("aria-pressed", "false");
    });

    it("leaves the Analytics title to the dialog header instead of repeating it", () => {
        render(<AnalyticsDashboard />);

        expect(screen.queryByText("Analytics")).not.toBeInTheDocument();
        expect(screen.getByText("Track your typing performance over time")).toBeInTheDocument();
    });

    it("uses the shared empty state when there are no sessions", () => {
        render(<AnalyticsDashboard />);

        expect(screen.getByText("No session data yet")).toBeInTheDocument();
    });
});
