import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
    testDir: "./e2e",
    fullyParallel: false,
    retries: 1,
    timeout: 60000,
    use: {
        baseURL: "http://localhost:3010",
        trace: "on-first-retry",
    },
    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },
    ],
    webServer: {
        command: "./node_modules/.bin/next dev --turbopack --port 3010",
        url: "http://localhost:3010",
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
    },
});
