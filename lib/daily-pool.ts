import { CURATED_SNIPPETS_LIST, type Snippet } from "./snippets";
import { pickDailySnippet } from "./daily";

/**
 * The four committed corpora are ~677 KB of JSON. Importing them statically put
 * every byte in the page's first-load chunk and defeated `useSnippets`'
 * progressive loading, so they are pulled in on demand instead. The resolved
 * pool is cached in a module-level promise: built once, shared by every caller.
 */
let poolPromise: Promise<readonly Snippet[]> | null = null;

async function buildPool(): Promise<readonly Snippet[]> {
    // JSON imports infer `language` as string; cast to the built-in Snippet shape.
    const datasets = (await Promise.all([
        import("@/data/snippets-javascript.json"),
        import("@/data/snippets-python.json"),
        import("@/data/snippets-java.json"),
        import("@/data/snippets-cpp.json"),
    ])) as unknown as { default: Snippet[] }[];

    const seen = new Set<string>();
    const deduped: Snippet[] = [];
    for (const snippet of CURATED_SNIPPETS_LIST) {
        if (snippet.problemId.startsWith("ai-drill-")) continue;
        if (seen.has(snippet.id)) continue;
        seen.add(snippet.id);
        deduped.push(snippet);
    }
    for (const dataset of datasets) {
        for (const snippet of dataset.default) {
            if (snippet.problemId.startsWith("ai-drill-")) continue;
            if (seen.has(snippet.id)) continue;
            seen.add(snippet.id);
            deduped.push(snippet);
        }
    }

    // Plain codepoint compare: ids are ASCII slugs, so locale-aware collation
    // bought nothing and cost a Collator call per comparison across ~1,800 items.
    deduped.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

    return Object.freeze(deduped);
}

function loadPool(): Promise<readonly Snippet[]> {
    poolPromise ??= buildPool();
    return poolPromise;
}

/**
 * The STABLE daily pool: curated snippets + the committed per-language corpora,
 * EXCLUDING any user-generated AI drills, deduped, and sorted by id.
 *
 * The committed JSON keeps this identical for every user, so date + pool =>
 * same snippet for everyone. Callers get a fresh array over the frozen
 * singleton, so nothing downstream can mutate the shared pool.
 */
export async function getDailyPool(): Promise<Snippet[]> {
    return [...(await loadPool())];
}

/** Today's date-seeded daily snippet, drawn from the stable built-in pool. */
export async function getTodaysDaily(dateStr: string): Promise<Snippet | null> {
    return pickDailySnippet(dateStr, await getDailyPool());
}
