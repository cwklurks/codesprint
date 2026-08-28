import { describe, it, expect, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders as render } from "@/test-utils/render";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { EmptyState } from "@/components/ui/EmptyState";

const options = [
    { value: "full", label: "Full" },
    { value: "partial", label: "Partial" },
    { value: "none", label: "None" },
] as const;

describe("SegmentedControl", () => {
    it("marks only the selected option as pressed", () => {
        render(
            <SegmentedControl
                label="Syntax highlighting"
                options={options}
                value="partial"
                onChange={() => {}}
            />,
        );

        expect(screen.getByRole("button", { name: "Partial" })).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByRole("button", { name: "Full" })).toHaveAttribute("aria-pressed", "false");
        expect(screen.getByRole("button", { name: "None" })).toHaveAttribute("aria-pressed", "false");
    });

    it("names the group for assistive tech", () => {
        render(
            <SegmentedControl label="Syntax highlighting" options={options} value="full" onChange={() => {}} />,
        );

        expect(screen.getByRole("group", { name: "Syntax highlighting" })).toBeInTheDocument();
    });

    it("reports the clicked option's value", () => {
        const onChange = vi.fn();
        render(
            <SegmentedControl label="Syntax highlighting" options={options} value="full" onChange={onChange} />,
        );

        fireEvent.click(screen.getByRole("button", { name: "None" }));

        expect(onChange).toHaveBeenCalledWith("none");
    });

    it("renders helper copy when an option supplies it", () => {
        render(
            <SegmentedControl
                label="Interface layout"
                orientation="vertical"
                options={[{ value: "ide", label: "IDE layout", helper: "Chakra chrome" }]}
                value="ide"
                onChange={() => {}}
            />,
        );

        expect(screen.getByText("Chakra chrome")).toBeInTheDocument();
    });
});

describe("EmptyState", () => {
    it("shows the title and the hint", () => {
        render(<EmptyState title="No scores yet" hint="Finish a run to see one." />);

        expect(screen.getByText("No scores yet")).toBeInTheDocument();
        expect(screen.getByText("Finish a run to see one.")).toBeInTheDocument();
    });

    it("omits the hint when none is given", () => {
        render(<EmptyState title="No scores yet" />);

        expect(screen.getByText("No scores yet")).toBeInTheDocument();
        expect(screen.queryByText("Finish a run to see one.")).not.toBeInTheDocument();
    });
});
