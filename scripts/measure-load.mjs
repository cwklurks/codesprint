import { chromium } from "@playwright/test";
import { gzipSync } from "node:zlib";

// Run against `npm start` after a production build, with a fresh browser cache.
const browser = await chromium.launch();
try {
    const page = await browser.newPage();
    const scripts = new Map();
    const pending = [];
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
    });
    page.on("requestfailed", (request) => errors.push(`Failed request: ${request.url()}`));
    page.on("response", (response) => {
        if (!new URL(response.url()).pathname.endsWith(".js")) return;
        if (!response.ok()) errors.push(`HTTP ${response.status()}: ${response.url()}`);
        pending.push(response.body().then((body) => {
            scripts.set(response.url(), { bytes: body.length, gzipBytes: gzipSync(body).length });
        }).catch((error) => errors.push(String(error))));
    });
    await page.goto(process.argv[2] ?? "http://localhost:3000");
    await page.locator(".monaco-editor .view-line").first().waitFor();
    await page.waitForLoadState("networkidle");
    await Promise.all(pending);
    if (errors.length) throw new Error(errors.join("\n"));
    const totals = [...scripts.values()].reduce(
        (sum, script) => ({ bytes: sum.bytes + script.bytes, gzipBytes: sum.gzipBytes + script.gzipBytes }),
        { bytes: 0, gzipBytes: 0 },
    );
    console.log(JSON.stringify({
        javascriptRequests: scripts.size,
        ...totals,
        note: "Idle page including lazy-loaded Monaco and its worker. gzipBytes is local gzip, not measured transfer size.",
    }, null, 2));
} finally {
    await browser.close();
}
