import type { SupportedLanguage, SnippetLength, Difficulty } from "@/lib/snippets";
import type { HistoryEntry, ErrorEntry } from "@/hooks/useTypingEngine";
import { idbGetAll, idbGet, idbPut, idbDelete, idbClear, isIdbAvailable, STORES } from "./idb-store";

export type SessionRecord = {
    id: string;
    date: string; // ISO string
    snippetId: string;
    language: SupportedLanguage;
    lengthCategory: SnippetLength;
    difficulty: Difficulty;
    wpm: number;
    rawWpm: number;
    accuracy: number;
    elapsedMs: number;
    totalKeystrokes: number;
    correctKeystrokes: number;
    errorCount: number;
    history: HistoryEntry[];
    patternScore?: number;
    // For AI drill weak pattern aggregation
    errors?: ErrorEntry[];
    snippetContentLength?: number;
    snippetContent?: string;
};

export type CreateSessionInput = Omit<SessionRecord, "id" | "date">;

export type SessionFilters = {
    language?: SupportedLanguage;
    lengthCategory?: SnippetLength;
    difficulty?: Difficulty;
    snippetId?: string;
    limit?: number;
    offset?: number;
};

const STORAGE_KEY = "codesprint-session-history";
const MAX_RECORDS = 500;

function isServer(): boolean {
    return typeof window === "undefined";
}

// ---------------------------------------------------------------------------
// localStorage helpers (fallback / SSR)
// ---------------------------------------------------------------------------

function readLocalStorage(): SessionRecord[] {
    if (isServer()) return [];
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (!stored) return [];
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed)) return [];
        return parsed as SessionRecord[];
    } catch {
        return [];
    }
}

function writeLocalStorage(records: SessionRecord[]): void {
    if (isServer()) return;
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch {
        // Storage quota exceeded or other error
    }
}

// ---------------------------------------------------------------------------
// Async API (IndexedDB primary, localStorage fallback)
// ---------------------------------------------------------------------------

export async function createSessionAsync(input: CreateSessionInput): Promise<SessionRecord | null> {
    if (isServer()) return null;

    const record: SessionRecord = {
        ...input,
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
    };

    try {
        if (await isIdbAvailable()) {
            await idbPut(STORES.sessions, record);
        }
    } catch {
        // IDB failed — localStorage write below is the fallback
    }

    // Always mirror to localStorage for sync readers (analytics, leaderboard)
    const existing = readLocalStorage();
    const updated = [record, ...existing].slice(0, MAX_RECORDS);
    writeLocalStorage(updated);

    return record;
}

export async function getSessionAsync(id: string): Promise<SessionRecord | null> {
    if (isServer()) return null;

    try {
        if (await isIdbAvailable()) {
            const record = await idbGet<SessionRecord>(STORES.sessions, id);
            return record ?? null;
        }
    } catch {
        // fall through
    }

    const records = readLocalStorage();
    return records.find((r) => r.id === id) ?? null;
}

export async function getSessionsAsync(filters?: SessionFilters): Promise<SessionRecord[]> {
    if (isServer()) return [];

    let records: SessionRecord[];
    try {
        if (await isIdbAvailable()) {
            records = await idbGetAll<SessionRecord>(STORES.sessions);
            // Sort by date descending (newest first)
            records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        } else {
            records = readLocalStorage();
        }
    } catch {
        records = readLocalStorage();
    }

    return applyFilters(records, filters);
}

export async function deleteSessionAsync(id: string): Promise<boolean> {
    if (isServer()) return false;

    let deletedInIdb = false;
    try {
        if (await isIdbAvailable()) {
            await idbDelete(STORES.sessions, id);
            deletedInIdb = true;
        }
    } catch {
        // fall through to localStorage update
    }

    const records = readLocalStorage();
    const filtered = records.filter((r) => r.id !== id);
    const deletedInLocalStorage = filtered.length !== records.length;
    if (deletedInLocalStorage) {
        writeLocalStorage(filtered);
    }
    return deletedInIdb || deletedInLocalStorage;
}

export async function clearSessionsAsync(): Promise<void> {
    if (isServer()) return;

    try {
        if (await isIdbAvailable()) {
            await idbClear(STORES.sessions);
        }
    } catch {
        // fall through
    }
    window.localStorage.removeItem(STORAGE_KEY);
}

export async function getSessionStatsAsync(filters?: Omit<SessionFilters, "limit" | "offset">): Promise<{
    totalSessions: number;
    averageWpm: number;
    averageAccuracy: number;
    bestWpm: number;
    totalTimeMs: number;
}> {
    const records = await getSessionsAsync(filters);

    if (records.length === 0) {
        return {
            totalSessions: 0,
            averageWpm: 0,
            averageAccuracy: 0,
            bestWpm: 0,
            totalTimeMs: 0,
        };
    }

    const totalWpm = records.reduce((sum, r) => sum + r.wpm, 0);
    const totalAccuracy = records.reduce((sum, r) => sum + r.accuracy, 0);
    const bestWpm = records.reduce((max, r) => (r.wpm > max ? r.wpm : max), 0);
    const totalTimeMs = records.reduce((sum, r) => sum + r.elapsedMs, 0);

    return {
        totalSessions: records.length,
        averageWpm: totalWpm / records.length,
        averageAccuracy: totalAccuracy / records.length,
        bestWpm,
        totalTimeMs,
    };
}

// ---------------------------------------------------------------------------
// Synchronous API (localStorage only — backward compatibility)
// ---------------------------------------------------------------------------

export function createSession(input: CreateSessionInput): SessionRecord | null {
    if (isServer()) return null;

    try {
        const record: SessionRecord = {
            ...input,
            id: crypto.randomUUID(),
            date: new Date().toISOString(),
        };

        const existing = readLocalStorage();
        const updated = [record, ...existing].slice(0, MAX_RECORDS);
        writeLocalStorage(updated);

        // Also write to IndexedDB in background (fire-and-forget)
        isIdbAvailable().then((ok) => {
            if (ok) idbPut(STORES.sessions, record);
        }).catch((err) => { console.warn("Background IDB write failed for session:", record.id, err); });

        return record;
    } catch {
        return null;
    }
}

export function getSession(id: string): SessionRecord | null {
    if (isServer()) return null;
    const records = readLocalStorage();
    return records.find((r) => r.id === id) ?? null;
}

export function getSessions(filters?: SessionFilters): SessionRecord[] {
    if (isServer()) return [];
    const records = readLocalStorage();
    return applyFilters(records, filters);
}

export function updateSession(id: string, updates: Partial<Omit<SessionRecord, "id" | "date">>): SessionRecord | null {
    if (isServer()) return null;

    const records = readLocalStorage();
    const index = records.findIndex((r) => r.id === id);
    if (index === -1) return null;

    const updated: SessionRecord = {
        ...records[index],
        ...updates,
        id: records[index].id,
        date: records[index].date,
    };

    const newRecords = [...records.slice(0, index), updated, ...records.slice(index + 1)];
    writeLocalStorage(newRecords);

    return updated;
}

export function deleteSession(id: string): boolean {
    if (isServer()) return false;

    const records = readLocalStorage();
    const filtered = records.filter((r) => r.id !== id);
    if (filtered.length === records.length) return false;
    writeLocalStorage(filtered);
    return true;
}

export function clearSessions(): void {
    if (isServer()) return;
    window.localStorage.removeItem(STORAGE_KEY);
}

export function getSessionStats(filters?: Omit<SessionFilters, "limit" | "offset">): {
    totalSessions: number;
    averageWpm: number;
    averageAccuracy: number;
    bestWpm: number;
    totalTimeMs: number;
} {
    const records = getSessions(filters);

    if (records.length === 0) {
        return {
            totalSessions: 0,
            averageWpm: 0,
            averageAccuracy: 0,
            bestWpm: 0,
            totalTimeMs: 0,
        };
    }

    const totalWpm = records.reduce((sum, r) => sum + r.wpm, 0);
    const totalAccuracy = records.reduce((sum, r) => sum + r.accuracy, 0);
    const bestWpm = records.reduce((max, r) => (r.wpm > max ? r.wpm : max), 0);
    const totalTimeMs = records.reduce((sum, r) => sum + r.elapsedMs, 0);

    return {
        totalSessions: records.length,
        averageWpm: totalWpm / records.length,
        averageAccuracy: totalAccuracy / records.length,
        bestWpm,
        totalTimeMs,
    };
}

export function getRecentSessions(count: number = 10): SessionRecord[] {
    return getSessions({ limit: count });
}

export function getSessionsBySnippet(snippetId: string): SessionRecord[] {
    return getSessions({ snippetId });
}

// ---------------------------------------------------------------------------
// Shared filter logic
// ---------------------------------------------------------------------------

function applyFilters(records: SessionRecord[], filters?: SessionFilters): SessionRecord[] {
    let result = records;

    if (filters?.language) {
        result = result.filter((r) => r.language === filters.language);
    }
    if (filters?.lengthCategory) {
        result = result.filter((r) => r.lengthCategory === filters.lengthCategory);
    }
    if (filters?.difficulty) {
        result = result.filter((r) => r.difficulty === filters.difficulty);
    }
    if (filters?.snippetId) {
        result = result.filter((r) => r.snippetId === filters.snippetId);
    }

    const offset = filters?.offset ?? 0;
    const limit = filters?.limit ?? result.length;

    return result.slice(offset, offset + limit);
}
