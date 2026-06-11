import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import { useDaily } from "../useDaily";
import { getTodaysDaily } from "@/lib/daily-pool";

// Mock the lazy pool so getTodaysDaily rejects (e.g. a chunk-load failure after
// a redeploy). The cancellation-guarded effect must swallow it: snippet stays
// null, the failure is logged, and there is no unhandled rejection.
vi.mock("@/lib/daily-pool", () => ({
    getTodaysDaily: vi.fn(),
}));

describe("useDaily (pool load failure)", () => {
    beforeEach(() => {
        vi.mocked(getTodaysDaily).mockRejectedValue(new Error("chunk load failed"));
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("keeps dailySnippet null and logs when the pool rejects", async () => {
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        const { result } = renderHook(() => useDaily());

        expect(result.current.dailySnippet).toBeNull();

        await waitFor(() => {
            expect(errorSpy).toHaveBeenCalled();
        });

        expect(result.current.dailySnippet).toBeNull();
    });
});
