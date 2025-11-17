"use client";

import createCache from "@emotion/cache";
import { CacheProvider } from "@emotion/react";
import { useServerInsertedHTML } from "next/navigation";
import { PropsWithChildren, useMemo } from "react";

/**
 * Provides a shared Emotion cache between server and client so Chakra's styles
 * are injected during SSR and no hydration mismatch occurs.
 */
export default function EmotionCacheProvider({ children }: PropsWithChildren) {
    const cache = useMemo(() => {
        const created = createCache({ key: "chakra", prepend: true });
        created.compat = true;
        return created;
    }, []);

    useServerInsertedHTML(() => (
        <style
            data-emotion={`${cache.key} ${Object.keys(cache.inserted).join(" ")}`}
            dangerouslySetInnerHTML={{ __html: Object.values(cache.inserted).join(" ") }}
        />
    ));

    return <CacheProvider value={cache}>{children}</CacheProvider>;
}
