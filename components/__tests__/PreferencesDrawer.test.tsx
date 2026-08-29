import type { ReactNode } from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { chakraSystem } from "@/lib/chakra-system";
import { PreferencesProvider } from "@/lib/preferences";
import PreferencesDrawer from "@/components/PreferencesDrawer";

function Providers({ children }: { children: ReactNode }) {
    return (
        <ChakraProvider value={chakraSystem}>
            <PreferencesProvider>{children}</PreferencesProvider>
        </ChakraProvider>
    );
}

function renderDrawer() {
    return render(
        <Providers>
            <PreferencesDrawer isOpen onClose={() => {}} />
        </Providers>,
    );
}

describe("PreferencesDrawer", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("names the drawer for assistive tech", () => {
        renderDrawer();

        expect(screen.getByRole("dialog", { name: "Preferences" })).toBeInTheDocument();
    });

    it("dismisses through the one shared close control", () => {
        renderDrawer();

        expect(screen.getAllByRole("button", { name: "Close" })).toHaveLength(1);
    });

    it("renders every boolean setting as a switch, AI drills included", () => {
        renderDrawer();

        // Chakra's SwitchRoot backs the control with a visually hidden checkbox.
        for (const label of [
            "Countdown overlay",
            "Vim mode",
            "Live stats during run",
            "Spaced repetition",
            "Adaptive difficulty",
            "Enable AI drills",
        ]) {
            expect(screen.getByRole("checkbox", { name: label })).toBeInTheDocument();
        }

        // The old On/Off pill is gone.
        expect(screen.queryByRole("button", { name: "Off" })).not.toBeInTheDocument();
    });

    // jsdom never runs the dialog's autofocus, so this only asserts the
    // precondition: the body is a programmatic focus target for `initialFocusEl`,
    // which is what keeps the opening focus ring off the viewport edge.
    it("makes the drawer body a focus target instead of the close button", () => {
        renderDrawer();

        const body = screen.getByRole("dialog", { name: "Preferences" })
            .querySelector<HTMLElement>(".chakra-drawer__body");

        expect(body).not.toBeNull();
        expect(body).toHaveAttribute("tabindex", "-1");
    });
});
