import { afterEach, describe, expect, it, vi } from "vitest";

import type { Snippet } from "../snippets";

// Stateful factory shared by every mocked corpus: while `shouldThrow` is set the
// dynamic import rejects (simulating a flaky/stale chunk fetch after a redeploy);
// once cleared the import resolves with a minimal daily-eligible snippet (6+
// non-empty lines of real logic so it clears the floor and skeletal filter).
const corpus = vi.hoisted(() => {
    let shouldThrow = true;
    function makeSnippet(id: string): Snippet {
        return {
            id,
            problemId: `test:${id}`,
            title: id,
            content: [
                "function run(n) {",
                "  let total = 0;",
                "  for (let i = 0; i < n; i++) {",
                "    total += i;",
                "  }",
                "  return total;",
                "}",
            ].join("\n"),
            language: "javascript",
            lengthCategory: "short",
            difficulty: "easy",
            lines: 7,
        };
    }
    return {
        setShouldThrow: (value: boolean) => {
            shouldThrow = value;
        },
        // Expose `default` as a getter so the throw fires when buildDailyPool
        // reads `module.default` (inside the awaited promise) rather than at
        // module-resolution time, yielding a clean dynamic-import rejection.
        load: (id: string) => ({
            get default() {
                if (shouldThrow) throw new Error("chunk load failed");
                return [makeSnippet(id)];
            },
        }),
    };
});

vi.mock("@/data/snippets-javascript.json", () => corpus.load("retry-js"));
vi.mock("@/data/snippets-python.json", () => corpus.load("retry-py"));
vi.mock("@/data/snippets-java.json", () => corpus.load("retry-java"));
vi.mock("@/data/snippets-cpp.json", () => corpus.load("retry-cpp"));

describe("getDailyPool retry after a load failure", () => {
    afterEach(() => {
        vi.resetModules();
    });

    it("retries on the next call instead of caching the rejection forever", async () => {
        const { getDailyPool } = await import("../daily-pool");

        await expect(getDailyPool()).rejects.toThrow("chunk load failed");

        corpus.setShouldThrow(false);

        await expect(getDailyPool()).resolves.toBeInstanceOf(Array);
    });
});
