import { describe, it, expect } from "vitest";
import { getPillButtonStyles } from "../session-styles";

describe("getPillButtonStyles — active affordance (IDE mode)", () => {
    it("underlines the active pill with the accent color", () => {
        const active = getPillButtonStyles(true, false);
        expect(active.borderBottom).toBe("2px solid var(--accent)");
    });

    it("keeps the inactive pill underline transparent so there is no layout shift", () => {
        const inactive = getPillButtonStyles(false, false);
        expect(inactive.borderBottom).toBe("2px solid transparent");
    });
});
