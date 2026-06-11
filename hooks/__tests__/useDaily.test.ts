import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import { useDaily } from "../useDaily";

describe("useDaily", () => {
    it("starts with a null daily snippet and resolves it after the lazy pool loads", async () => {
        const { result } = renderHook(() => useDaily());

        // The pool is lazy-loaded, so the snippet is null on the first render.
        expect(result.current.dailySnippet).toBeNull();

        await waitFor(() => {
            expect(result.current.dailySnippet).not.toBeNull();
        });

        expect(result.current.dailySnippet!.id).toBeTruthy();
    });
});
