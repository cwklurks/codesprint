import React from "react";
import { describe, it, expect, vi } from "vitest";
import { waitFor } from "@testing-library/react";
import { renderWithProviders as render } from "@/test-utils/render";
import ResultCard from "../ResultCard";

// ResultGraph draws to <canvas>, which jsdom does not implement; stub it out.
vi.mock("../ResultGraph", () => ({ default: () => null }));

const baseProps = {
    wpm: 80,
    rawWpm: 85,
    accuracy: 0.97,
    timeMs: 12000,
    errors: 0,
    snippetTitle: "Binary Search",
    snippetId: "algo-js-binary-search",
    language: "javascript" as const,
    difficulty: "medium",
    lengthCategory: "medium",
    autoAdvanceDeadline: null,
    history: [],
    contentLength: 100,
    totalKeystrokes: 96,
    correctKeystrokes: 93,
};

describe("ResultCard honesty", () => {
    it("labels uncorrected errors honestly when mistakes were typed then fixed", () => {
        // Two mistakes were made (errorLog) but both corrected (errors = 0).
        const errorLog = [
            { expected: "a", got: "b", index: 1 },
            { expected: ";", got: ":", index: 2 },
        ];
        const { container } = render(<ResultCard {...baseProps} errors={0} errorLog={errorLog} />);

        // The headline stat must not claim "incorrect" while the Most-Mistaken
        // list below shows fumbled keys.
        expect(container.textContent).toContain("0 uncorrected");
        expect(container.textContent).not.toContain("incorrect");
        expect(container.textContent).toContain("Most Mistaken (all attempts)");
    });

    it("shows the count raw wpm actually divides, not the snippet's characters", () => {
        // 200 keystrokes over 30s is 200 / 5 / 0.5 = 80 raw wpm. The card has to
        // show that 200: the character count includes auto-advanced indentation
        // that was never a keystroke, so it cannot divide into raw.
        const { container } = render(
            <ResultCard
                {...baseProps}
                errorLog={[]}
                rawWpm={80}
                timeMs={30000}
                totalKeystrokes={200}
                correctKeystrokes={194}
                contentLength={243}
            />
        );

        expect(container.textContent).toContain("Keystrokes");
        expect(container.textContent).toContain("200");
        expect(container.textContent).not.toContain("243");
        // Accuracy's shortfall is spelled out in the same units.
        expect(container.textContent).toContain("6 mistyped");
    });

    it("calls the peer percentile an estimate", () => {
        const { container } = render(<ResultCard {...baseProps} errorLog={[]} />);
        expect(container.textContent).toContain("est. faster than peers");
    });

    it("surfaces Accuracy on the on-screen stat row (matching the share card)", () => {
        const { container } = render(<ResultCard {...baseProps} accuracy={0.97} errorLog={[]} />);
        expect(container.textContent).toContain("Accuracy");
        expect(container.textContent).toContain("97%");
    });

    it("points the keyboard hint at the next problem, not a page", () => {
        const { container } = render(<ResultCard {...baseProps} errorLog={[]} onNext={() => {}} />);
        expect(container.textContent).toContain("next problem");
        expect(container.textContent).not.toContain("next page");
    });
});

describe("ResultCard WPM count-up", () => {
    it("settles on the exact rounded final WPM", async () => {
        const { getByTestId } = render(<ResultCard {...baseProps} wpm={80.4} errorLog={[]} />);
        // The count-up must land on the snapshot value, never a lerp artifact.
        await waitFor(() => expect(getByTestId("result-wpm").textContent).toBe("80"));
    });

    it("never overshoots the target while counting", async () => {
        const { getByTestId } = render(<ResultCard {...baseProps} wpm={132} errorLog={[]} />);
        const node = getByTestId("result-wpm");
        expect(Number(node.textContent)).toBeLessThanOrEqual(132);
        await waitFor(() => expect(node.textContent).toBe("132"));
    });
});
