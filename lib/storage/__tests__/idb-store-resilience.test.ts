/**
 * Connection-lifecycle behaviour for the IndexedDB wrapper.
 *
 * Two failure modes that only show up on real browsers with more than one tab
 * open: an upgrade blocked by a stale connection (must reject, not hang) and a
 * newer tab upgrading the schema underneath us (must close, not block them).
 */

import { describe, it, expect } from "vitest";
import "fake-indexeddb/auto";
import { idbGetAll, idbPut, resetDbConnection, STORES } from "../idb-store";

const DB_NAME = "codesprint";

function openRaw(
    version: number,
    onUpgrade?: (db: IDBDatabase) => void,
): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, version);
        if (onUpgrade) request.onupgradeneeded = () => onUpgrade(request.result);
        request.onblocked = () => reject(new Error("blocked"));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/** The v1 schema, so the wrapper's v1 -> v2 migration has something to migrate. */
function createV1Stores(db: IDBDatabase): void {
    const sessions = db.createObjectStore(STORES.sessions, { keyPath: "id" });
    sessions.createIndex("by-date", "date");
    sessions.createIndex("by-language", "language");
    sessions.createIndex("by-snippet", "snippetId");
    db.createObjectStore(STORES.mastery, { keyPath: "snippetId" });
    db.createObjectStore(STORES.achievements, { keyPath: "id" });
    db.createObjectStore(STORES.customSnippets, { keyPath: "id" });
    db.createObjectStore(STORES.meta, { keyPath: "key" });
}

describe("idb-store connection lifecycle", () => {
    it("rejects instead of hanging when an upgrade is blocked, and recovers after", async () => {
        resetDbConnection();

        // A stale v1 connection that never closes blocks our v2 upgrade.
        const stale = await openRaw(1, createV1Stores);

        await expect(idbGetAll(STORES.meta)).rejects.toThrow();

        stale.close();
        resetDbConnection();

        // The cached promise was cleared, so the next call opens a fresh one.
        await idbPut(STORES.meta, { key: "recovered", value: true });
        const records = await idbGetAll<{ key: string }>(STORES.meta);
        expect(records.some((record) => record.key === "recovered")).toBe(true);
    });

    it("closes its connection when another tab upgrades the schema", async () => {
        resetDbConnection();
        await idbPut(STORES.meta, { key: "open", value: true });

        // Without db.onversionchange this open would fire `blocked` and reject.
        const upgraded = await openRaw(99);
        expect(upgraded.version).toBe(99);
        upgraded.close();
        resetDbConnection();
    });
});
