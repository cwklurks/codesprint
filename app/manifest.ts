import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME, SITE_THEME_COLOR, SITE_TITLE } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
    return {
        id: "/",
        name: SITE_TITLE,
        short_name: SITE_NAME,
        description: SITE_DESCRIPTION,
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: SITE_THEME_COLOR,
        theme_color: SITE_THEME_COLOR,
        categories: ["education", "productivity", "utilities"],
        icons: [
            { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
            { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
    };
}
