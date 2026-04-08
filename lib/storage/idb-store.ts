/**
 * IndexedDB wrapper with typed object stores for CodeSprint 2.0.
 *
 * Provides a thin async API over IndexedDB with:
 * - Typed stores (sessions, mastery, achievements, custom-snippets, meta)
 * - Versioned schema via onupgradeneeded
 * - SSR-safe (returns null on server)
 */

import type { SessionRecord } from "./session-history";

// ---------------------------------------------------------------------------
// Store value types
// ---------------------------------------------------------------------------

export type MasteryRecord = {
    snippetId: string;
    language: string;
    bestWpm: number;
    bestAccuracy: number;
    attempts: number;
    lastPracticed: string; // ISO
    // SM-2 spaced repetition fields
    easeFactor: number; // default 2.5
    interval: number; // days
    repetitions: number;
    nextReviewDate: string; // "YYYY-MM-DD"
    lastQuality: number; // 0-5
    lastReviewDate: string; // "YYYY-MM-DD"
};

export type SkillModelRecord = {
    language: string; // keyPath
    estimatedWpm: number;
    estimatedAccuracy: number;
    currentDifficulty: string;
    confidenceLevel: number;
    sessionCount: number;
    consecutivePromotions: number;
    consecutiveDemotions: number;
};

export type AchievementRecord = {
    id: string;
    unlockedAt: string; // ISO
    meta?: Record<string, unknown>;
};

export type CustomSnippetRecord = {
    id: string;
    title: string;
    content: string;
    language: string;
    createdAt: string; // ISO
    // NEW - discriminator
    source?: "user" | "ai";
    // NEW - AI-specific metadata (only when source === "ai")
    aiMetadata?: {
        provider: "claude" | "openai" | "fireworks";
        model: string;
        reasoning: string;           // why this drill was generated
        focusAreas: string[];        // token categories targeted
        weakPatternsInput: string[]; // what was sent to the AI
        tokensUsed: number;
        costUsd: number;
        accepted: boolean;
        difficulty: string;
        lengthCategory: string;
    };
};

export type MetaRecord = {
    key: string;
    value: unknown;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DB_NAME = "codesprint";
const DB_VERSION = 2;

export const STORES = {
    sessions: "sessions",
    mastery: "mastery",
    achievements: "achievements",
    customSnippets: "custom-snippets",
    meta: "meta",
    skillModels: "skill-models",
} as const;

type StoreName = (typeof STORES)[keyof typeof STORES];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isServer(): boolean {
    return typeof window === "undefined" || typeof indexedDB === "undefined";
}

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
    if (isServer()) return Promise.reject(new Error("IndexedDB unavailable on server"));

    if (dbPromise) return dbPromise;

    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            const oldVersion = (event as IDBVersionChangeEvent).oldVersion;

            // V1 stores
            if (oldVersion < 1) {
                const sessionStore = db.createObjectStore(STORES.sessions, { keyPath: "id" });
                sessionStore.createIndex("by-date", "date");
                sessionStore.createIndex("by-language", "language");
                sessionStore.createIndex("by-snippet", "snippetId");

                db.createObjectStore(STORES.mastery, { keyPath: "snippetId" });
                db.createObjectStore(STORES.achievements, { keyPath: "id" });
                db.createObjectStore(STORES.customSnippets, { keyPath: "id" });
                db.createObjectStore(STORES.meta, { keyPath: "key" });
            }

            // V2: skill-models store + mastery by-language index
            if (oldVersion < 2) {
                db.createObjectStore(STORES.skillModels, { keyPath: "language" });

                const masteryStore = (event.target as IDBOpenDBRequest).transaction!.objectStore(STORES.mastery);
                if (!masteryStore.indexNames.contains("by-language")) {
                    masteryStore.createIndex("by-language", "language");
                }
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
            dbPromise = null;
            reject(request.error);
        };
    });

    return dbPromise;
}

function tx(storeName: StoreName, mode: IDBTransactionMode): Promise<IDBObjectStore> {
    return getDb().then((db) => {
        const transaction = db.transaction(storeName, mode);
        return transaction.objectStore(storeName);
    });
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// ---------------------------------------------------------------------------
// Generic CRUD
// ---------------------------------------------------------------------------

export async function idbPut<T>(storeName: StoreName, value: T): Promise<void> {
    if (isServer()) return;
    const store = await tx(storeName, "readwrite");
    await promisify(store.put(value));
}

export async function idbGet<T>(storeName: StoreName, key: IDBValidKey): Promise<T | undefined> {
    if (isServer()) return undefined;
    const store = await tx(storeName, "readonly");
    return promisify<T | undefined>(store.get(key) as IDBRequest<T | undefined>);
}

export async function idbGetAll<T>(storeName: StoreName): Promise<T[]> {
    if (isServer()) return [];
    const store = await tx(storeName, "readonly");
    return promisify<T[]>(store.getAll() as IDBRequest<T[]>);
}

export async function idbDelete(storeName: StoreName, key: IDBValidKey): Promise<void> {
    if (isServer()) return;
    const store = await tx(storeName, "readwrite");
    await promisify(store.delete(key));
}

export async function idbClear(storeName: StoreName): Promise<void> {
    if (isServer()) return;
    const store = await tx(storeName, "readwrite");
    await promisify(store.clear());
}

export async function idbCount(storeName: StoreName): Promise<number> {
    if (isServer()) return 0;
    const store = await tx(storeName, "readonly");
    return promisify(store.count());
}

// ---------------------------------------------------------------------------
// Batch operations
// ---------------------------------------------------------------------------

export async function idbPutMany<T>(storeName: StoreName, values: T[]): Promise<void> {
    if (isServer() || values.length === 0) return;
    const db = await getDb();
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);

    for (const value of values) {
        store.put(value);
    }

    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}

// ---------------------------------------------------------------------------
// Session-specific queries
// ---------------------------------------------------------------------------

export async function idbGetSessionsByIndex(
    indexName: string,
    value: IDBValidKey,
): Promise<SessionRecord[]> {
    if (isServer()) return [];
    const store = await tx(STORES.sessions, "readonly");
    const index = store.index(indexName);
    return promisify<SessionRecord[]>(index.getAll(value) as IDBRequest<SessionRecord[]>);
}

// ---------------------------------------------------------------------------
// Database status
// ---------------------------------------------------------------------------

export async function isIdbAvailable(): Promise<boolean> {
    if (isServer()) return false;
    try {
        await getDb();
        return true;
    } catch {
        return false;
    }
}

/** Reset the cached db connection (useful for testing) */
export function resetDbConnection(): void {
    dbPromise = null;
}

// ---------------------------------------------------------------------------
// Meta convenience helpers
// ---------------------------------------------------------------------------

export async function getMetaValue<T>(key: string): Promise<T | undefined> {
    const record = await idbGet<MetaRecord>(STORES.meta, key);
    return record?.value as T | undefined;
}

export async function setMetaValue<T>(key: string, value: T): Promise<void> {
    await idbPut<MetaRecord>(STORES.meta, { key, value });
}
