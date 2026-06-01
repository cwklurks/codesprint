import { CURATED_SNIPPETS_LIST, type Snippet } from "./snippets";
import { pickDailySnippet } from "./daily";

import javascriptSnippets from "@/data/snippets-javascript.json";
import pythonSnippets from "@/data/snippets-python.json";
import javaSnippets from "@/data/snippets-java.json";
import cppSnippets from "@/data/snippets-cpp.json";

// JSON imports infer `language` as string; cast to the built-in Snippet shape.
const BUILTIN_DATASETS = [
    javascriptSnippets,
    pythonSnippets,
    javaSnippets,
    cppSnippets,
] as unknown as Snippet[][];

/**
 * The STABLE daily pool: curated snippets + the committed per-language corpora,
 * EXCLUDING any user-generated AI drills, deduped, and sorted by id.
 *
 * Importing the committed JSON directly keeps this identical for every user, so
 * date + pool => same snippet for everyone.
 */
export function getDailyPool(): Snippet[] {
    const all: Snippet[] = [...CURATED_SNIPPETS_LIST, ...BUILTIN_DATASETS.flat()];

    const seen = new Set<string>();
    const deduped: Snippet[] = [];
    for (const snippet of all) {
        if (snippet.problemId.startsWith("ai-drill-")) continue;
        if (seen.has(snippet.id)) continue;
        seen.add(snippet.id);
        deduped.push(snippet);
    }

    return deduped.sort((a, b) => a.id.localeCompare(b.id));
}

/** Today's date-seeded daily snippet, drawn from the stable built-in pool. */
export function getTodaysDaily(dateStr: string): Snippet | null {
    return pickDailySnippet(dateStr, getDailyPool());
}
