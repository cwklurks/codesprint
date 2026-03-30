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
            const aiDrills = customSnippets
                .filter(isAcceptedAIDrill)
                .map(toSnippet);
            
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

    // Load current language first (priority), then others in background
    useEffect(() => {
        let mounted = true;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        let idleId: number | null = null;

        async function loadProgressively() {
            // Load AI drills first
            const aiDrills = await loadAIDrills();
            if (!mounted) return;
            aiDrillsRef.current = aiDrills;

            await loadLanguage(currentLanguage);
            if (!mounted) return;

            rebuildSnippets();
            setIsLoading(false);

            const otherLanguages = LANGUAGES.filter(lang => lang !== currentLanguage);

            const loadInBackground = async () => {
                for (const lang of otherLanguages) {
                    if (!mounted) return;
                    await loadLanguage(lang);
                    if (!mounted) return;
                    rebuildSnippets();
                }
            };

            if (typeof requestIdleCallback !== "undefined") {
                idleId = requestIdleCallback(() => loadInBackground());
            } else {
                timeoutId = setTimeout(() => loadInBackground(), 100);
            }
        }

        loadProgressively();

        return () => {
            mounted = false;
            if (idleId !== null && typeof cancelIdleCallback !== "undefined") {
                cancelIdleCallback(idleId);
            }
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
            }
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
