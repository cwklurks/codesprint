import { useEffect, useState, useRef, useCallback } from "react";
import { CURATED_SNIPPETS_LIST, type Snippet, type SupportedLanguage } from "@/lib/snippets";
import { toSnippet, isAcceptedAIDrill } from "@/lib/ai/snippet-bridge";
import type { CustomSnippetRecord } from "@/lib/storage/idb-store";

type LanguageLoadState = {
    javascript: boolean;
    python: boolean;
    java: boolean;
    cpp: boolean;
};

const LANGUAGES: SupportedLanguage[] = ["javascript", "python", "java", "cpp"];

// Dynamic imports for each language file
// Type assertion needed because JSON imports infer `language` as string, not SupportedLanguage
const languageImports: Record<SupportedLanguage, () => Promise<{ default: Snippet[] }>> = {
    javascript: () => import("@/data/snippets-javascript.json") as Promise<{ default: Snippet[] }>,
    python: () => import("@/data/snippets-python.json") as Promise<{ default: Snippet[] }>,
    java: () => import("@/data/snippets-java.json") as Promise<{ default: Snippet[] }>,
    cpp: () => import("@/data/snippets-cpp.json") as Promise<{ default: Snippet[] }>,
};

export function useSnippets(currentLanguage: SupportedLanguage = "python") {
    const [snippets, setSnippets] = useState<Snippet[]>(CURATED_SNIPPETS_LIST);
    const [isLoading, setIsLoading] = useState(true);
    const loadedLanguages = useRef<LanguageLoadState>({
        javascript: false,
        python: false,
        java: false,
        cpp: false,
    });
    const snippetsByLanguage = useRef<Record<SupportedLanguage, Snippet[]>>({
        javascript: [],
        python: [],
        java: [],
        cpp: [],
    });
    const aiDrillsRef = useRef<Snippet[]>([]);

    // Load AI drills from IndexedDB
    const loadAIDrills = useCallback(async (): Promise<Snippet[]> => {
        try {
            // Dynamic import to avoid SSR issues
            const { idbGetAll, STORES } = await import("@/lib/storage/idb-store");
            const customSnippets = await idbGetAll<CustomSnippetRecord>(STORES.customSnippets);
            
            // Filter to accepted AI drills and convert to Snippet type
            const aiDrills: Snippet[] = [];
            for (const cs of customSnippets) {
                if (isAcceptedAIDrill(cs)) aiDrills.push(toSnippet(cs));
            }
            return aiDrills;
        } catch (error) {
            console.error("Failed to load AI drills:", error);
            return [];
        }
    }, []);

    // Load a single language's snippets
    const loadLanguage = useCallback(async (lang: SupportedLanguage): Promise<Snippet[]> => {
        if (loadedLanguages.current[lang]) {
            return snippetsByLanguage.current[lang];
        }

        try {
            const importedSnippets = await languageImports[lang]();
            const loaded: Snippet[] = importedSnippets.default;
            snippetsByLanguage.current[lang] = loaded;
            loadedLanguages.current[lang] = true;
            return loaded;
        } catch (error) {
            console.error(`Failed to load ${lang} snippets:`, error);
            return [];
        }
    }, []);

    // Rebuild merged snippets from all loaded languages + AI drills
    const rebuildSnippets = useCallback(() => {
        const allLoaded = LANGUAGES.flatMap(lang => snippetsByLanguage.current[lang]);
        setSnippets([...CURATED_SNIPPETS_LIST, ...allLoaded, ...aiDrillsRef.current]);
    }, []);

    // Load ONLY the active language, rather than eagerly pulling all four on an
    // idle callback. Switching language re-runs this effect and fetches that file
    // then; already-loaded languages stay in the merged list. (The daily pool does
    // still read all four corpora, but on its own idle callback — see useDaily.)
    useEffect(() => {
        let mounted = true;

        async function loadActiveLanguage() {
            if (!loadedLanguages.current[currentLanguage]) {
                setIsLoading(true);
            }

            // Load AI drills first
            const aiDrills = await loadAIDrills();
            if (!mounted) return;
            aiDrillsRef.current = aiDrills;

            await loadLanguage(currentLanguage);
            if (!mounted) return;

            rebuildSnippets();
            setIsLoading(false);
        }

        loadActiveLanguage();

        return () => {
            mounted = false;
        };
    }, [currentLanguage, loadLanguage, rebuildSnippets, loadAIDrills]);

    // Refresh AI drills (call after accepting a new drill)
    const refreshAIDrills = useCallback(async () => {
        const drills = await loadAIDrills();
        aiDrillsRef.current = drills;
        rebuildSnippets();
    }, [loadAIDrills, rebuildSnippets]);

    return { snippets, isLoading, refreshAIDrills };
}
