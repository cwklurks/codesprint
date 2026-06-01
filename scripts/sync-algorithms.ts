#!/usr/bin/env bun

/**
 * Syncs real, snippet-sized code from the MIT-licensed TheAlgorithms repos into
 * data/algorithms-snippets.json (the same DatasetSnippet shape build-snippets.ts
 * consumes). Run manually like sync:leetcode; the output is committed and the
 * build just processes it.
 *
 *   bun scripts/sync-algorithms.ts
 *
 * Attribution: see data/THIRD-PARTY-NOTICES.md (MIT, TheAlgorithms).
 */

import { execFileSync } from "node:child_process";
import { readdirSync, statSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
    SOURCE_EXTENSIONS,
    isExcludedPath,
    stripHeaderComment,
    stripTrailingDemo,
    isUsableSnippet,
    titleFromPath,
    type SourceLanguage,
} from "../lib/snippet-source";

const REPOS: Record<SourceLanguage, string> = {
    python: "Python",
    javascript: "JavaScript",
    java: "Java",
    cpp: "C-Plus-Plus",
};

const LANGUAGES: SourceLanguage[] = ["javascript", "python", "java", "cpp"];
const PER_LANGUAGE_CAP = 300;
const OUTPUT_FILE = join("data", "algorithms-snippets.json");

type DatasetSnippet = {
    id: string;
    lang: SourceLanguage;
    difficulty: string;
    title: string;
    content: string;
    sourceSlug: string;
};

function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        if (entry === ".git" || entry === "node_modules") continue;
        const full = join(dir, entry);
        const st = statSync(full);
        if (st.isDirectory()) out.push(...walk(full));
        else out.push(full);
    }
    return out;
}

/** Evenly sample `cap` items across the sorted list so snippets span many topics. */
function pickSpread<T>(items: T[], cap: number): T[] {
    if (items.length <= cap) return items;
    const stride = items.length / cap;
    const out: T[] = [];
    for (let i = 0; out.length < cap && Math.floor(i) < items.length; i += stride) {
        out.push(items[Math.floor(i)]);
    }
    return out;
}

async function downloadRepo(repo: string, dest: string): Promise<void> {
    // No shell: fetch the tarball, then extract with tar via an argument array.
    const res = await fetch(`https://api.github.com/repos/TheAlgorithms/${repo}/tarball`, {
        headers: { "User-Agent": "codesprint-sync" },
    });
    if (!res.ok) throw new Error(`Download failed for ${repo}: ${res.status} ${res.statusText}`);
    const tarPath = join(dest, "repo.tar.gz");
    writeFileSync(tarPath, Buffer.from(await res.arrayBuffer()));
    execFileSync("tar", ["xzf", tarPath, "-C", dest, "--strip-components=1"], { stdio: "inherit" });
    rmSync(tarPath, { force: true });
}

function collectForLanguage(lang: SourceLanguage, root: string): DatasetSnippet[] {
    const exts = SOURCE_EXTENSIONS[lang];
    const seen = new Set<string>();
    const candidates: DatasetSnippet[] = [];

    const files = walk(root)
        .map((abs) => ({ abs, rel: abs.slice(root.length + 1) }))
        .filter(({ rel }) => exts.some((e) => rel.toLowerCase().endsWith(e)))
        .filter(({ rel }) => !isExcludedPath(rel))
        .sort((a, b) => a.rel.localeCompare(b.rel));

    for (const { abs, rel } of files) {
        let raw: string;
        try {
            raw = readFileSync(abs, "utf-8");
        } catch {
            continue;
        }
        const content = stripTrailingDemo(stripHeaderComment(raw, lang), lang);
        if (!isUsableSnippet(content, lang)) continue;

        const dedupKey = content.replace(/\s+/g, " ").trim();
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);

        candidates.push({
            id: `algo-${lang}-${rel.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}`,
            lang,
            difficulty: "medium",
            title: titleFromPath(rel),
            content,
            sourceSlug: `TheAlgorithms/${REPOS[lang]}/${rel}`,
        });
    }

    return pickSpread(candidates, PER_LANGUAGE_CAP);
}

async function main(): Promise<void> {
    const all: DatasetSnippet[] = [];

    for (const lang of LANGUAGES) {
        const tmp = mkdtempSync(join(tmpdir(), `cs-algo-${lang}-`));
        try {
            console.log(`Downloading TheAlgorithms/${REPOS[lang]} ...`);
            await downloadRepo(REPOS[lang], tmp);
            const snippets = collectForLanguage(lang, tmp);
            console.log(`  ${lang}: ${snippets.length} usable snippets`);
            all.push(...snippets);
        } finally {
            rmSync(tmp, { recursive: true, force: true });
        }
    }

    writeFileSync(OUTPUT_FILE, JSON.stringify(all, null, 0));
    console.log(`Wrote ${all.length} snippets to ${OUTPUT_FILE}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
