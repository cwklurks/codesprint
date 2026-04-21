// components/analytics/__tests__/WeakPatternDashboard.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { ReactNode } from "react";
import "@testing-library/jest-dom/vitest";

vi.mock("@/lib/analytics/weak-pattern-trends", () => ({
    aggregateWeakPatternTrends: vi.fn(),
}));

import WeakPatternDashboard from "../WeakPatternDashboard";
import { aggregateWeakPatternTrends } from "@/lib/analytics/weak-pattern-trends";

const mockAggregate = vi.mocked(aggregateWeakPatternTrends);

function wrapper({ children }: { children: ReactNode }) {
    return <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;
}

describe("WeakPatternDashboard", () => {
    beforeEach(() => {
        mockAggregate.mockReset();
    });

    it("renders the empty state when no error data exists", () => {
        mockAggregate.mockReturnValue({
            sessionsWithErrorData: 0,
            totalSessions: 0,
            trends: [],
            timeSeries: [],
            topImproving: [],
            topDeclining: [],
        });

        render(<WeakPatternDashboard timeRange="month" />, { wrapper });
        expect(screen.getByText(/Type more sessions/i)).toBeInTheDocument();
    });

    it("renders top-movers lists and category cards when data exists", () => {
        const improvingTrend = {
            category: "keyword" as const,
            currentRate: 0.05,
            previousRate: 0.10,
            deltaPercentagePoints: -5,
            status: "improving" as const,
            samples: 20,
        };
        const decliningTrend = {
            category: "operator" as const,
            currentRate: 0.10,
            previousRate: 0.05,
            deltaPercentagePoints: 5,
            status: "declining" as const,
            samples: 20,
        };
        mockAggregate.mockReturnValue({
            sessionsWithErrorData: 20,
            totalSessions: 20,
            trends: [improvingTrend, decliningTrend],
            timeSeries: [
                { category: "keyword", points: [{ date: "2026-04-01", errorRate: 0.05, samples: 5 }, { date: "2026-04-02", errorRate: 0.03, samples: 5 }] },
                { category: "operator", points: [{ date: "2026-04-01", errorRate: 0.03, samples: 5 }, { date: "2026-04-02", errorRate: 0.06, samples: 5 }] },
            ],
            topImproving: [improvingTrend],
            topDeclining: [decliningTrend],
        });

        render(<WeakPatternDashboard timeRange="month" />, { wrapper });
        expect(screen.getByText("Top improving")).toBeInTheDocument();
        expect(screen.getByText("Top declining")).toBeInTheDocument();
        // Keywords appears in both the top-movers list AND the category card grid
        expect(screen.getAllByText("Keywords").length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText("Operators").length).toBeGreaterThanOrEqual(1);
    });
});
