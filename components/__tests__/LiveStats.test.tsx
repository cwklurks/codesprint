import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { act } from "@testing-library/react";
import { renderWithProviders as render } from "@/test-utils/render";
import LiveStats from "../LiveStats";

describe("LiveStats", () => {
    it("renders with correct structure", () => {
        const { container } = render(<LiveStats wpm={60} accuracy={0.95} />);
        const box = container.firstChild as HTMLElement;
        expect(box).toBeTruthy();
        // Verify both stats are rendered
        expect(box.textContent).toContain("60");
        expect(box.textContent).toContain("95%");
    });

    it("renders WPM and accuracy with correct precision", () => {
        const { getByText } = render(<LiveStats wpm={75.7} accuracy={0.987} />);
        expect(getByText("76")).toBeInTheDocument(); // rounded
        expect(getByText("99%")).toBeInTheDocument(); // (0.987 * 100).toFixed(0)
    });

    it("shows dash when WPM is null", () => {
        const { getByText } = render(<LiveStats wpm={null} accuracy={1} />);
        expect(getByText("—")).toBeInTheDocument();
    });
});

describe("LiveStats screen-reader announcements", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("announces both numbers from a single polite region", () => {
        const { container } = render(<LiveStats wpm={60} accuracy={0.95} />);
        const regions = container.querySelectorAll("[aria-live]");
        expect(regions).toHaveLength(1);

        const region = regions[0];
        expect(region.getAttribute("aria-live")).toBe("polite");
        expect(region.getAttribute("aria-atomic")).toBe("true");
        expect(region.textContent).toBe("60 words per minute, 95 percent accuracy");
    });

    it("hides the visible numerals from the screen reader", () => {
        const { getByText } = render(<LiveStats wpm={60} accuracy={0.95} />);
        expect(getByText("60").closest("[aria-hidden='true']")).toBeTruthy();
        expect(getByText("95%").closest("[aria-hidden='true']")).toBeTruthy();
    });

    it("throttles announcements so the reader is not flooded", () => {
        vi.useFakeTimers();
        const { container, rerender } = render(<LiveStats wpm={60} accuracy={0.95} />);
        const region = container.querySelector("[aria-live]") as HTMLElement;
        expect(region.textContent).toBe("60 words per minute, 95 percent accuracy");

        act(() => {
            rerender(<LiveStats wpm={61} accuracy={0.94} />);
        });
        expect(region.textContent).toBe("60 words per minute, 95 percent accuracy");

        act(() => {
            vi.advanceTimersByTime(5_000);
        });
        expect(region.textContent).toBe("61 words per minute, 94 percent accuracy");
    });

    it("stays silent before the run starts", () => {
        const { container } = render(<LiveStats wpm={null} accuracy={1} />);
        const region = container.querySelector("[aria-live]") as HTMLElement;
        expect(region.textContent).toBe("");
    });
});
