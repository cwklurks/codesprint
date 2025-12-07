import { useEffect, useState, useRef, useCallback } from "react";
import { CURATED_SNIPPETS_LIST, type Snippet, type SupportedLanguage } from "@/lib/snippets";

type LanguageLoadState = {
    javascript: boolean;
    python: boolean;
    java: boolean;
    cpp: boolean;
};

const LANGUAGES: SupportedLanguage[] = ["javascript", "python", "java", "cpp"];

// Dynamic imports for each language file
const languageImports: Record<SupportedLanguage, () => Promise<{ default: Snippet[] }>> = {
    javascript: () => import("@/data/snippets-javascript.json"),
    python: () => import("@/data/snippets-python.json"),
    java: () => import("@/data/snippets-java.json"),
    cpp: () => import("@/data/snippets-cpp.json"),
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

    // Load a single language's snippets
    const loadLanguage = useCallback(async (lang: SupportedLanguage): Promise<Snippet[]> => {
        if (loadedLanguages.current[lang]) {
            return snippetsByLanguage.current[lang];
        }

        try {
            const module = await languageImports[lang]();
            const loaded: Snippet[] = module.default;
            snippetsByLanguage.current[lang] = loaded;
            loadedLanguages.current[lang] = true;
            return loaded;
        } catch (error) {
            console.error(`Failed to load ${lang} snippets:`, error);
            return [];
        }
    }, []);

    // Rebuild merged snippets from all loaded languages
    const rebuildSnippets = useCallback(() => {
        const allLoaded = LANGUAGES.flatMap(lang => snippetsByLanguage.current[lang]);
        setSnippets([...CURATED_SNIPPETS_LIST, ...allLoaded]);
    }, []);

    // Load current language first (priority), then others in background
    useEffect(() => {
        let mounted = true;

        async function loadProgressively() {
            // 1. Load current language first (fast path - user can start immediately)
            const currentLangSnippets = await loadLanguage(currentLanguage);
            if (!mounted) return;
            
            // Update with current language snippets immediately
            rebuildSnippets();
            setIsLoading(false);

            // 2. Load other languages in background (low priority)
            const otherLanguages = LANGUAGES.filter(lang => lang !== currentLanguage);
            
            // Use requestIdleCallback for background loading if available
            const loadInBackground = async () => {
                for (const lang of otherLanguages) {
                    if (!mounted) return;
                    await loadLanguage(lang);
                    if (!mounted) return;
                    rebuildSnippets();
                }
            };

            if (typeof requestIdleCallback !== "undefined") {
                requestIdleCallback(() => loadInBackground());
            } else {
                // Fallback: small delay to let UI settle
                setTimeout(() => loadInBackground(), 100);
            }
        }

        loadProgressively();

        return () => {
            mounted = false;
        };
    }, [currentLanguage, loadLanguage, rebuildSnippets]);

    return { snippets, isLoading };
}
