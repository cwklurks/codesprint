import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: "*",
            allow: "/",
            // The BYOK proxy has nothing to index and should never be crawled.
            disallow: "/api/",
        },
        sitemap: `${SITE_URL}/sitemap.xml`,
    };
}
