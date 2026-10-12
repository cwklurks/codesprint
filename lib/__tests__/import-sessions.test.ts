import { beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { exportSessions, importSessions } from "../export";
import { idbClear, STORES } from "../storage/idb-store";

const session = {
    id: "legacy-session", date: "2026-10-12", snippetId: "example",
    language: "python", wpm: 50, accuracy: 1, elapsedMs: 1000,
};

beforeEach(async () => {
    await idbClear(STORES.sessions);
    await idbClear(STORES.customSnippets);
});

describe("importSessions", () => {
    it.each(["legacy", "wrapped"])("imports and validates %s sessions, deduplicating existing records", async (format) => {
        const records = [session, null, { ...session, id: "invalid", wpm: "50" }];
        const content = JSON.stringify(format === "legacy" ? records : { version: 2, sessions: records });
        expect(await importSessions(content)).toMatchObject({ imported: 1, invalid: 2, duplicates: 0, total: 3 });
        expect(JSON.parse(await exportSessions()).sessions).toEqual([session]);
        expect(await importSessions(content)).toMatchObject({ imported: 0, invalid: 2, duplicates: 1, total: 3 });
    });

    it("preserves v2 snippet validation and deduplication", async () => {
        const snippet = { id: "custom-one", title: "Example", content: "pass", language: "python", createdAt: "2026-10-12" };
        const content = JSON.stringify({ version: 2, sessions: [session], customSnippets: [snippet, null, { id: "invalid" }] });
        expect(await importSessions(content)).toMatchObject({ imported: 1, invalid: 0, total: 4, customSnippetsImported: 1, customSnippetsDuplicates: 0 });
        expect(JSON.parse(await exportSessions()).customSnippets).toEqual([snippet]);
        expect(await importSessions(content)).toMatchObject({ imported: 0, duplicates: 1, customSnippetsImported: 0, customSnippetsDuplicates: 1 });
    });

    it.each(["[]", "null", "42", "bad json", '{"sessions":{},"customSnippets":false}'])("handles empty or unsupported input: %s", async (content) => {
        expect(await importSessions(content)).toEqual({ imported: 0, duplicates: 0, invalid: 0, total: 0 });
    });
});
