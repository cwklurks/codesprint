import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// The trainer is a single client-side route; everything else is app state.
export default function sitemap(): MetadataRoute.Sitemap {
    return [
        {
            url: SITE_URL,
            lastModified: new Date(),
            changeFrequency: "weekly",
            priority: 1,
        },
    ];
}
