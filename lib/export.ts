/**
 * Data export/import module for CodeSprint.
 *
 * Supports JSON and CSV formats for session history.
 * Import validates and deduplicates records.
 */

import type { SessionRecord } from "./storage/session-history";
import type { CustomSnippetRecord } from "./storage/idb-store";
import { idbGetAll, idbPutMany, STORES } from "./storage/idb-store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExportFormat = "json" | "csv";

export type ExportData = {
    version: number;
    exportedAt: string;
    sessions: SessionRecord[];
    customSnippets?: CustomSnippetRecord[];  // NEW - AI drills and user snippets
};

export type ImportResult = {
    imported: number;
    duplicates: number;
    invalid: number;
    total: number;
    customSnippetsImported?: number;  // NEW
    customSnippetsDuplicates?: number;  // NEW
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export async function exportSessions(format: ExportFormat = "json"): Promise<string> {
    const [sessions, customSnippets] = await Promise.all([
        idbGetAll<SessionRecord>(STORES.sessions),
        idbGetAll<CustomSnippetRecord>(STORES.customSnippets),
    ]);

    // Sort by date descending
    const sortedSessions = [...sessions].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    if (format === "csv") {
        // CSV only exports sessions (custom snippets are JSON-only)
        return sessionsToCSV(sortedSessions);
    }

    const data: ExportData = {
        version: 2,  // Bumped version for custom snippets
        exportedAt: new Date().toISOString(),
        sessions: sortedSessions,
        customSnippets,  // NEW - include custom snippets
    };

    return JSON.stringify(data, null, 2);
}

function sessionsToCSV(sessions: SessionRecord[]): string {
    const headers = [
        "id", "date", "snippetId", "language", "lengthCategory", "difficulty",
        "wpm", "rawWpm", "accuracy", "elapsedMs", "totalKeystrokes",
        "correctKeystrokes", "errorCount",
    ];

    const rows = sessions.map((s) =>
        [
            s.id, s.date, s.snippetId, s.language, s.lengthCategory, s.difficulty,
            s.wpm, s.rawWpm, s.accuracy, s.elapsedMs, s.totalKeystrokes,
            s.correctKeystrokes, s.errorCount,
        ].map(csvEscape).join(",")
    );

    return [headers.join(","), ...rows].join("\n");
}

function csvEscape(value: unknown): string {
    const str = String(value ?? "");
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export async function importSessions(content: string): Promise<ImportResult> {
    const parsed = parseImportData(content);

    if (parsed.sessions.length === 0 && parsed.customSnippets.length === 0) {
        return { imported: 0, duplicates: 0, invalid: 0, total: 0 };
    }

    // Validate and import sessions
    const validSessions: SessionRecord[] = [];
    let invalid = 0;
    for (const record of parsed.sessions) {
        if (isValidSessionRecord(record)) {
            validSessions.push(record);
        } else {
            invalid++;
        }
    }

    // Deduplicate sessions against existing records
    const existingSessions = await idbGetAll<SessionRecord>(STORES.sessions);
    const existingSessionIds = new Set(existingSessions.map((r) => r.id));
    const newSessions = validSessions.filter((r) => !existingSessionIds.has(r.id));
    const sessionDuplicates = validSessions.length - newSessions.length;

    if (newSessions.length > 0) {
        await idbPutMany<SessionRecord>(STORES.sessions, newSessions);
    }

    // Validate and import custom snippets
    const validSnippets: CustomSnippetRecord[] = [];
    for (const record of parsed.customSnippets) {
        if (isValidCustomSnippetRecord(record)) {
            validSnippets.push(record as CustomSnippetRecord);
        }
    }

    // Deduplicate snippets against existing records
    const existingSnippets = await idbGetAll<CustomSnippetRecord>(STORES.customSnippets);
    const existingSnippetIds = new Set(existingSnippets.map((r) => r.id));
    const newSnippets = validSnippets.filter((r) => !existingSnippetIds.has(r.id));
    const snippetDuplicates = validSnippets.length - newSnippets.length;

    if (newSnippets.length > 0) {
        await idbPutMany<CustomSnippetRecord>(STORES.customSnippets, newSnippets);
    }

    return {
        imported: newSessions.length,
        duplicates: sessionDuplicates,
        invalid,
        total: parsed.sessions.length + parsed.customSnippets.length,
        customSnippetsImported: newSnippets.length,
        customSnippetsDuplicates: snippetDuplicates,
    };
}

type ParsedImportData = {
    sessions: unknown[];
    customSnippets: unknown[];
};

function parseImportData(content: string): ParsedImportData {
    try {
        const json = JSON.parse(content);

        // ExportData format with custom snippets (v2+)
        if (json && typeof json === "object") {
            return {
                sessions: Array.isArray(json.sessions) ? json.sessions : [],
                customSnippets: Array.isArray(json.customSnippets) ? json.customSnippets : [],
            };
        }

        // Plain array format (sessions only, legacy)
        if (Array.isArray(json)) {
            return { sessions: json, customSnippets: [] };
        }

        return { sessions: [], customSnippets: [] };
    } catch {
        return { sessions: [], customSnippets: [] };
    }
}

function isValidSessionRecord(value: unknown): value is SessionRecord {
    if (!value || typeof value !== "object") return false;
    const r = value as Record<string, unknown>;
    return (
        typeof r.id === "string" &&
        typeof r.date === "string" &&
        typeof r.snippetId === "string" &&
        typeof r.language === "string" &&
        typeof r.wpm === "number" &&
        typeof r.accuracy === "number" &&
        typeof r.elapsedMs === "number"
    );
}

function isValidCustomSnippetRecord(value: unknown): value is CustomSnippetRecord {
    if (!value || typeof value !== "object") return false;
    const r = value as Record<string, unknown>;
    return (
        typeof r.id === "string" &&
        typeof r.title === "string" &&
        typeof r.content === "string" &&
        typeof r.language === "string" &&
        typeof r.createdAt === "string"
    );
}

// ---------------------------------------------------------------------------
// File download helper
// ---------------------------------------------------------------------------

export function downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
