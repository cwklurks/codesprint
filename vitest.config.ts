import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
    esbuild: {
        jsx: "automatic",
    },
    test: {
        globals: true,
        environment: "jsdom",
        setupFiles: ["./vitest.setup.ts"],
        exclude: ["node_modules", "e2e"],
    },
    resolve: {
        alias: {
            "@": resolve(__dirname, "./"),
        },
    },
});
