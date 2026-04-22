import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
    plugins: [react()],
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
