import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
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
