"use client";

import createCache from "@emotion/cache";
import { CacheProvider } from "@emotion/react";
import { useServerInsertedHTML } from "next/navigation";
import { PropsWithChildren, useState } from "react";

/**
 * Provides a shared Emotion cache between server and client so Chakra's styles
 * are injected during SSR and no hydration mismatch occurs.
 *
 * `useServerInsertedHTML` fires once per streaming flush. Emitting the WHOLE
 * cache each time duplicated Chakra's ~80 KB style block a dozen times over
 * (95% of the prerendered HTML). We track the names inserted since the previous
 * flush and emit only those — the documented Next.js App Router pattern.
 */
export default function EmotionCacheProvider({ children }: PropsWithChildren) {
    const [{ cache, flush }] = useState(() => {
        const cache = createCache({ key: "chakra", prepend: true });
        cache.compat = true;

        const prevInsert = cache.insert;
        let inserted: string[] = [];
        cache.insert = (...args) => {
            const serialized = args[1];
            if (cache.inserted[serialized.name] === undefined) {
                inserted.push(serialized.name);
            }
            return prevInsert(...args);
        };

        const flush = () => {
            const flushed = inserted;
            inserted = [];
            return flushed;
        };

        return { cache, flush };
    });

    useServerInsertedHTML(() => {
        const names = flush();
        if (names.length === 0) return null;

        let styles = "";
        for (const name of names) {
            const rules = cache.inserted[name];
            if (typeof rules === "string") styles += rules;
        }

        return (
            <style
                data-emotion={`${cache.key} ${names.join(" ")}`}
                dangerouslySetInnerHTML={{ __html: styles }}
            />
        );
    });

    return <CacheProvider value={cache}>{children}</CacheProvider>;
}
