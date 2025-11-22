import { useEffect, useState } from "react";
import { CURATED_SNIPPETS_LIST, normalizeDataset, type Snippet } from "@/lib/snippets";

export function useSnippets() {
    const [snippets, setSnippets] = useState<Snippet[]>(CURATED_SNIPPETS_LIST);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        async function loadSnippets() {
            try {
                // Dynamic import to split the bundle
                const module = await import("@/data/leetcode-snippets.json");
                if (!mounted) return;

                const dataset = module.default;
                const normalized = normalizeDataset(dataset);

                setSnippets((prev) => {
                    // Merge curated and dataset snippets
                    // Curated first to ensure they are always available and prioritized if needed
                    return [...CURATED_SNIPPETS_LIST, ...normalized];
                });
            } catch (error) {
                console.error("Failed to load snippets:", error);
            } finally {
                if (mounted) {
                    setIsLoading(false);
                }
            }
        }

        loadSnippets();

        return () => {
            mounted = false;
        };
    }, []);

    return { snippets, isLoading };
}
