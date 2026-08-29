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
    isAIDrill?: boolean;
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

// Keyed per reason: a single shared latch let the first (often harmless) warning
// silence a later data-loss one for the rest of the page's life.
const warnedReasons = new Set<string>();

function warnOnce(reason: string, message: string, error?: unknown): void {
    if (warnedReasons.has(reason)) return;
    warnedReasons.add(reason);
    console.warn(message, error ?? "");
}

function isQuotaError(error: unknown): boolean {
    return (
        error instanceof DOMException &&
        (error.name === "QuotaExceededError" ||
            error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
            error.code === 22)
    );
}

/**
 * `idbBacked` says whether the records being written are also in IndexedDB. It
 * only affects what the quota warning is allowed to claim: for a user whose IDB
 * write failed (or who has no IDB) this mirror is the primary store, and telling
 * them their full history is safe elsewhere would be false.
 */
function writeLocalStorage(records: SessionRecord[], idbBacked: boolean = false): void {
    if (isServer()) return;
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
        return;
    } catch (error) {
        if (!isQuotaError(error)) {
            warnOnce("mirror-write", "Failed to mirror session history to localStorage:", error);
            return;
        }
    }

    // Quota cliff: silently dropping the write loses every sync reader's data
    // with no signal. Keep the newest half (records are newest-first) and retry
    // once, warning so the loss is visible instead of invisible.
    const trimmed = records.slice(0, Math.max(1, Math.floor(records.length / 2)));
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
        warnOnce(
            "quota-trim",
            `Session history mirror exceeded the localStorage quota; trimmed to the ${trimmed.length} most recent sessions.` +
                (idbBacked ? " IndexedDB still holds the full history." : " The older sessions are gone."),
        );
    } catch (error) {
        warnOnce(
            "quota-trim-failed",
            "Session history mirror could not be written even after trimming:",
            error,
        );
    }
}

/**
 * The localStorage mirror serves SYNCHRONOUS readers only (analytics
 * aggregations, weak-pattern trends, leaderboard). Those read the scalar
 * metrics plus `errors` + `snippetContent` for token-category analysis; none of
 * them read the per-second `history` samples, which are the single largest
 * field in a record.
 *
 * Dropping `history` is therefore safe ONLY for a record IndexedDB has actually
 * accepted. When the IDB write failed or IDB is unavailable, this mirror is the
 * primary store and the record is kept whole.
 */
function toMirrorRecord(record: SessionRecord, backedByIdb: boolean): SessionRecord {
    return backedByIdb ? { ...record, history: [] } : record;
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

    let backedByIdb = false;
    try {
        if (await isIdbAvailable()) {
            await idbPut(STORES.sessions, record);
            backedByIdb = true;
        }
    } catch {
        // IDB failed — localStorage write below is the fallback
    }

    // Always mirror to localStorage for sync readers (analytics, leaderboard)
    const existing = readLocalStorage();
    const updated = [toMirrorRecord(record, backedByIdb), ...existing].slice(0, MAX_RECORDS);
    writeLocalStorage(updated, backedByIdb);

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
            // Sort by date descending (newest first). ISO-8601 strings sort
            // chronologically as plain strings, so this avoids allocating two
            // Date objects per comparison across the whole history.
            records.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
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

    try {
        window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
        warnOnce("clear-failed", "Failed to clear the session history mirror:", error);
    }
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

        // The IndexedDB write below is fire-and-forget, so nothing here can
        // confirm the record is backed: mirror it whole.
        const existing = readLocalStorage();
        const updated = [toMirrorRecord(record, false), ...existing].slice(0, MAX_RECORDS);
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
