import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "../ErrorBoundary";

const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
    if (shouldThrow) throw new Error("Test error");
    return <div>Normal render</div>;
};

describe("ErrorBoundary", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("renders children when no error occurs", () => {
        render(
            <ErrorBoundary>
                <div data-testid="child">Hello</div>
            </ErrorBoundary>
        );
        expect(screen.getByTestId("child")).toBeInTheDocument();
    });

    it("renders fallback UI when error occurs", () => {
        render(
            <ErrorBoundary>
                <ThrowError shouldThrow={true} />
            </ErrorBoundary>
        );
        expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });
});
