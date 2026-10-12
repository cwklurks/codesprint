import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { useDaily } from "../useDaily";
import { getDailyNumber } from "@/lib/daily";
import { getDailyProgress, recordDailyResult } from "@/lib/daily-store";
import { getTodaysDaily } from "@/lib/daily-pool";
import type { Snippet } from "@/lib/snippets";

vi.mock("@/lib/daily-pool", () => ({ getTodaysDaily: vi.fn() }));
const snippet = (date: string): Snippet => ({ id: date, problemId: date, title: date, content: "pass", language: "python", lengthCategory: "short", difficulty: "easy", lines: 1 });
const loadSnippet = vi.mocked(getTodaysDaily);

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 12, 23, 59, 59));
    localStorage.clear();
    loadSnippet.mockReset().mockImplementation(async (date) => snippet(date!));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

async function load() { await act(async () => { await vi.advanceTimersByTimeAsync(201); }); }

describe("useDaily local calendar", () => {
    it("rolls over at local midnight, replaces the snippet and resets completion", async () => {
        recordDailyResult("2026-10-12", { wpm: 50, accuracy: 1 });
        const { result } = renderHook(() => useDaily());
        await load();
        expect(result.current.dailySnippet?.id).toBe("2026-10-12");
        expect(result.current.completed).toBe(true);
        await act(async () => { await vi.advanceTimersByTimeAsync(799); });
        expect(result.current.today).toBe("2026-10-13");
        expect(result.current.dayNumber).toBe(getDailyNumber("2026-10-13"));
        expect(result.current.completed).toBe(false);
        expect(result.current.dailySnippet).toBeNull();
        await load();
        expect(result.current.dailySnippet?.id).toBe("2026-10-13");
        act(() => result.current.record({ wpm: 90, accuracy: 0.95 }));
        expect(getDailyProgress().lastCompletedDate).toBe("2026-10-13");
    });

    it.each(["focus", "visibilitychange", "pageshow"])("refreshes the date and persisted completion on %s after a suspended tab", async (event) => {
        const { result } = renderHook(() => useDaily());
        await load();
        vi.setSystemTime(new Date(2026, 9, 15, 9));
        recordDailyResult("2026-10-15", { wpm: 80, accuracy: 1 });
        act(() => { (event === "visibilitychange" ? document : window).dispatchEvent(new Event(event)); });
        expect(result.current.today).toBe("2026-10-15");
        expect(result.current.completed).toBe(true);
        expect(result.current.dailySnippet).toBeNull();
        await load();
        expect(result.current.dailySnippet?.id).toBe("2026-10-15");
    });

    it("does not let an old asynchronous snippet overwrite the new day", async () => {
        let resolveOld!: (value: Snippet) => void;
        loadSnippet.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
        const { result } = renderHook(() => useDaily());
        await load();
        await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
        await load();
        expect(result.current.dailySnippet?.id).toBe("2026-10-13");
        await act(async () => resolveOld(snippet("2026-10-12")));
        expect(result.current.dailySnippet?.id).toBe("2026-10-13");
    });

    it("records using the current local day even if a caller retained an old callback", () => {
        const { result } = renderHook(() => useDaily());
        const record = result.current.record;
        vi.setSystemTime(new Date(2026, 9, 13, 0, 1));
        act(() => record({ wpm: 90, accuracy: 0.95 }));
        expect(getDailyProgress().lastCompletedDate).toBe("2026-10-13");
    });

    it("renders a date-independent server placeholder and hydrates on a different date", async () => {
        function DateLabel() { const daily = useDaily(); return <span>{daily.dayNumber ? `Daily #${daily.dayNumber}` : "Daily Challenge"}</span>; }
        const html = renderToString(<DateLabel />);
        expect(html).toBe("<span>Daily Challenge</span>");
        vi.setSystemTime(new Date(2026, 9, 15));
        const container = document.createElement("div");
        container.innerHTML = html;
        document.body.appendChild(container);
        const onRecoverableError = vi.fn();
        let root!: ReturnType<typeof hydrateRoot>;
        await act(async () => { root = hydrateRoot(container, <DateLabel />, { onRecoverableError }); });
        expect(onRecoverableError).not.toHaveBeenCalled();
        expect(container.textContent).toBe(`Daily #${getDailyNumber("2026-10-15")}`);
        act(() => root.unmount());
        container.remove();
    });
});

it("keeps an in-flight run attributed to its starting date after midnight", async () => {
    const { result } = renderHook(() => useDaily());
    const challengeDate = result.current.today;
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    act(() => result.current.record({ wpm: 90, accuracy: 0.95 }, challengeDate));
    expect(result.current.today).toBe("2026-10-13");
    expect(result.current.completed).toBe(false);
    expect(getDailyProgress().completedDates).toEqual(["2026-10-12"]);
});

it.each([
    [new Date(2026, 11, 31, 23, 59, 59), "2027-01-01"],
    [new Date(2028, 1, 28, 23, 59, 59), "2028-02-29"],
    [new Date(2026, 2, 8), "2026-03-09"],
    [new Date(2026, 10, 1), "2026-11-02"],
])("schedules the next local midnight from %s", async (start, expected) => {
    vi.setSystemTime(start);
    const { result } = renderHook(() => useDaily());
    const midnight = new Date(start);
    midnight.setHours(24, 0, 0, 0);
    await act(async () => { await vi.advanceTimersByTimeAsync(midnight.getTime() - start.getTime()); });
    expect(result.current.today).toBe(expected);
});

it("removes scheduled work and event listeners on unmount", () => {
    const { unmount } = renderHook(() => useDaily());
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    act(() => window.dispatchEvent(new Event("focus")));
    expect(vi.getTimerCount()).toBe(0);
});
