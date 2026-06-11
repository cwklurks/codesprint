import { CURATED_SNIPPETS_LIST, type Snippet } from "./snippets";
import { pickDailySnippet } from "./daily";
import { isSkeletal } from "./snippet-filter";

// Dynamic imports keep the ~684 KB committed corpora out of the homepage bundle;
// they load only when the daily pool is first requested. JSON imports infer
// `language` as string, so cast each module's default to the Snippet shape.
const builtinDatasetLoaders: Array<() => Promise<{ default: Snippet[] }>> = [
    () => import("@/data/snippets-javascript.json") as Promise<{ default: Snippet[] }>,
    () => import("@/data/snippets-python.json") as Promise<{ default: Snippet[] }>,
    () => import("@/data/snippets-java.json") as Promise<{ default: Snippet[] }>,
    () => import("@/data/snippets-cpp.json") as Promise<{ default: Snippet[] }>,
];

/**
 * Daily snippets must have at least this many non-empty (trimmed) lines so a
 * daily is never a trivial 1-5 line run. Practice mode keeps short snippets;
 * only the daily pool enforces this floor.
 */
export const DAILY_MIN_NON_EMPTY_LINES = 6;

function nonEmptyLineCount(content: string): number {
    return content
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0).length;
}

function meetsDailyFloor(snippet: Snippet): boolean {
    if (nonEmptyLineCount(snippet.content) < DAILY_MIN_NON_EMPTY_LINES) return false;
    if (isSkeletal(snippet.content, snippet.language)) return false;
    return true;
}

// Cache the built+filtered pool in a module-level promise so the corpora are
// imported and processed at most once per session, no matter how many callers.
let poolPromise: Promise<Snippet[]> | null = null;

async function buildDailyPool(): Promise<Snippet[]> {
    const datasets = await Promise.all(builtinDatasetLoaders.map((load) => load()));
    const builtin = datasets.flatMap((module) => module.default);
    const all: Snippet[] = [...CURATED_SNIPPETS_LIST, ...builtin];

    const seen = new Set<string>();
    const deduped: Snippet[] = [];
    for (const snippet of all) {
        if (snippet.problemId.startsWith("ai-drill-")) continue;
        if (seen.has(snippet.id)) continue;
        if (!meetsDailyFloor(snippet)) continue;
        seen.add(snippet.id);
        deduped.push(snippet);
    }

    return deduped.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * The STABLE daily pool: curated snippets + the committed per-language corpora,
 * EXCLUDING any user-generated AI drills, snippets below the daily line floor,
 * and skeletal stubs; deduped, and sorted by id.
 *
 * The committed JSON is lazy-loaded (dynamic import) so it stays out of the
 * homepage bundle, then cached in a module-level promise. The pool is identical
 * for every user, so date + pool => same snippet for everyone.
 *
 * Returns a shallow copy each call: the array is fresh so callers cannot reorder
 * or splice the cached pool, but the snippet objects are shared references and
 * must be treated as immutable.
 */
export async function getDailyPool(): Promise<Snippet[]> {
    // On failure (e.g. a stale chunk hash after a redeploy) clear the cache so
    // the next call retries instead of re-awaiting the same rejection forever.
    poolPromise ??= buildDailyPool().catch((error) => {
        poolPromise = null;
        throw error;
    });
    const pool = await poolPromise;
    return [...pool];
}

/** Today's date-seeded daily snippet, drawn from the stable built-in pool. */
export async function getTodaysDaily(dateStr: string): Promise<Snippet | null> {
    return pickDailySnippet(dateStr, await getDailyPool());
}
