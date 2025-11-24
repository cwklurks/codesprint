export type LeaderboardEntry = {
    id: string;
    wpm: number;
    accuracy: number;
    date: string; // ISO string
    language: string;
    snippetId: string;
};

const STORAGE_KEY = "codesprint-leaderboard";

export function saveScore(entry: Omit<LeaderboardEntry, "id" | "date">) {
    if (typeof window === "undefined") return;

    try {
        const newEntry: LeaderboardEntry = {
            ...entry,
            id: crypto.randomUUID(),
            date: new Date().toISOString(),
        };

        const existing = getLeaderboard();
        const updated = [...existing, newEntry]
            .sort((a, b) => b.wpm - a.wpm)
            .slice(0, 50); // Keep top 50

        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
        console.warn("Failed to save score", err);
    }
}

export function getLeaderboard(limit: number = 50): LeaderboardEntry[] {
    if (typeof window === "undefined") return [];

    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (!stored) return [];
        const parsed = JSON.parse(stored) as LeaderboardEntry[];
        return parsed.slice(0, limit);
    } catch (err) {
        console.warn("Failed to load leaderboard", err);
        return [];
    }
}

export function clearLeaderboard() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(STORAGE_KEY);
}
