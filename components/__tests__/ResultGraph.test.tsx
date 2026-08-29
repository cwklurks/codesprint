import React from "react";
import { describe, it, expect } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithProviders as render } from "@/test-utils/render";
import ResultGraph, { type ResultGraphPoint } from "../ResultGraph";

/**
 * The plot's user units are pinned to its CSS width and jsdom reports zeros for
 * every box, so the hover handler would bail out. Stub a real 800x300 frame on
 * the hover surface only — the tooltip keeps jsdom's zero box, which is what
 * makes the component fall back to its estimated tooltip size.
 */
const GRAPH_WIDTH = 800;
const GRAPH_HEIGHT = 300;
const FRAME = {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: GRAPH_WIDTH,
    bottom: GRAPH_HEIGHT,
    width: GRAPH_WIDTH,
    height: GRAPH_HEIGHT,
    toJSON: () => ({}),
} as DOMRect;

const DATA: ResultGraphPoint[] = [
    { time: 1, wpm: 40, raw: 44, errors: 0, burst: 50 },
    { time: 2, wpm: 90, raw: 95, errors: 1, burst: 99 },
    { time: 3, wpm: 120, raw: 128, errors: 0, burst: 130 },
];

function tooltipOf(container: HTMLElement): HTMLElement | null {
    return container.querySelector<HTMLElement>("[data-tooltip='result-graph']");
}

function hoverAt(container: HTMLElement, clientX: number) {
    const overlay = container.querySelector<HTMLElement>("[data-hover-surface='result-graph']");
    if (!overlay) throw new Error("hover surface missing");
    overlay.getBoundingClientRect = () => FRAME;
    fireEvent.mouseMove(overlay, { clientX, clientY: 10 });
}

describe("ResultGraph tooltip", () => {
    it("renders no tooltip until the plot is hovered", () => {
        const { container } = render(<ResultGraph data={DATA} />);
        expect(tooltipOf(container)).toBeNull();
    });

    it("flips the tooltip below a point near the top instead of escaping the plot", () => {
        // The last sample is the run's peak, so it sits near the plot's ceiling.
        // Pinned above it, the tooltip used to leave the card and cover the
        // metadata pills above the graph.
        const { container } = render(<ResultGraph data={DATA} />);
        hoverAt(container, GRAPH_WIDTH - 10);

        const tooltip = tooltipOf(container);
        expect(tooltip).not.toBeNull();
        const top = Number.parseFloat(tooltip!.style.top);
        expect(top).toBeGreaterThanOrEqual(0);
        expect(top).toBeLessThan(GRAPH_HEIGHT);
    });

    it("pulls the tooltip in from the right edge", () => {
        const { container } = render(<ResultGraph data={DATA} />);
        hoverAt(container, GRAPH_WIDTH - 10);

        const left = Number.parseFloat(tooltipOf(container)!.style.left);
        // The hovered point is at the plot's right edge; a tooltip centred there
        // would hang off the card, so the clamp walks it back inside.
        expect(left).toBeGreaterThan(0);
        expect(left).toBeLessThan(GRAPH_WIDTH - 20);
    });

    it("pulls the tooltip in from the left edge", () => {
        const { container } = render(<ResultGraph data={DATA} />);
        hoverAt(container, 0);

        const tooltip = tooltipOf(container)!;
        // The synthetic zero sample sits at the y axis (x = 40 in plot units);
        // centred there, half the tooltip would sit outside the plot.
        expect(Number.parseFloat(tooltip.style.left)).toBeGreaterThan(40);
        expect(tooltip.style.transform).toBe("translateX(-50%)");
    });
});
