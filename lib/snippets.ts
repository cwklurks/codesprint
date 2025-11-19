"use client";

import leetcodeDataset from "@/data/leetcode-snippets.json";

export type SupportedLanguage = "javascript" | "python" | "java" | "cpp";
export type SnippetLength = "short" | "medium" | "long";
export type Difficulty = "easy" | "medium" | "hard";

export type Problem = {
    id: string;
    title: string;
    summary: string;
    language: SupportedLanguage;
    availableLengths: SnippetLength[];
};

export type Snippet = {
    id: string;
    problemId: string;
    title: string;
    content: string;
    language: SupportedLanguage;
    lengthCategory: SnippetLength;
    difficulty: Difficulty;
    lines: number;
    sourceSlug?: string;
    frontendId?: number;
};

type ProblemFilters = {
    length?: SnippetLength;
};

type SnippetFilters = {
    length?: SnippetLength;
};

type DatasetSnippet = {
    id?: string;
    lang?: string;
    difficulty?: string;
    title?: string;
    content?: string;
    lines?: number;
    lengthCategory?: string;
    problemId?: string;
    frontendId?: number;
    sourceSlug?: string;
};

type SnippetDefinition = {
    id: string;
    language: SupportedLanguage;
    difficulty: Difficulty;
    title: string;
    content: string;
    sourceSlug?: string;
    lengthCategory?: SnippetLength;
};

const LENGTH_THRESHOLDS = {
    short: 15,
    medium: 40,
} as const;

const LENGTH_ORDER: Record<SnippetLength, number> = {
    short: 0,
    medium: 1,
    long: 2,
};

const PYTHON_DOCSTRING_MARKERS = [":type", ":rtype", ":param"];

const CURATED_SNIPPETS: Snippet[] = [
    defineSnippet({
        id: "js-array-dedupe-short",
        language: "javascript",
        difficulty: "easy",
        title: "Array helper utilities",
        sourceSlug: "js-array-helpers",
        lengthCategory: "short",
        content: `export function unique<T>(values: T[]): T[] {
    const seen = new Set<T>();
    const output: T[] = [];
    for (const value of values) {
        if (!seen.has(value)) {
            seen.add(value);
            output.push(value);
        }
    }
    return output;
}

export function chunk<T>(values: T[], size: number): T[][] {
    if (size <= 0) return [values];
    const result: T[][] = [];
    for (let index = 0; index < values.length; index += size) {
        result.push(values.slice(index, index + size));
    }
    return result;
}`,
    }),
    defineSnippet({
        id: "js-array-dedupe-medium",
        language: "javascript",
        difficulty: "medium",
        title: "Array helper utilities (extended)",
        sourceSlug: "js-array-helpers",
        lengthCategory: "medium",
        content: `type Comparator<T> = (a: T, b: T) => number;

export function sortBy<T>(values: T[], iteratee: (item: T) => string | number, comparator?: Comparator<T>): T[] {
    const derived = values.map((value) => ({ value, key: iteratee(value) }));
    const cmp: Comparator<typeof derived[number]> =
        comparator ?? ((a, b) => (a.key > b.key ? 1 : a.key < b.key ? -1 : 0));
    return derived.sort(cmp).map((item) => item.value);
}

export function groupBy<T>(values: T[], iteratee: (item: T) => string): Record<string, T[]> {
    return values.reduce<Record<string, T[]>>((acc, value) => {
        const key = iteratee(value);
        acc[key] ??= [];
        acc[key].push(value);
        return acc;
    }, {});
}`,
    }),
    defineSnippet({
        id: "py-stream-reader-short",
        language: "python",
        difficulty: "easy",
        title: "Stream reader",
        sourceSlug: "py-stream-reader",
        lengthCategory: "short",
        content: `from collections import deque
from typing import Iterable, Iterator, TypeVar

T = TypeVar("T")

class Window(Iterator[T]):
    def __init__(self, source: Iterable[T], size: int) -> None:
        self._source = iter(source)
        self._size = max(1, size)
        self._buffer: deque[T] = deque()

    def __iter__(self) -> "Window[T]":
        return self

    def __next__(self) -> list[T]:
        while len(self._buffer) < self._size:
            self._buffer.append(next(self._source))
        item = list(self._buffer)
        self._buffer.popleft()
        return item`,
    }),
    defineSnippet({
        id: "py-stream-reader-medium",
        language: "python",
        difficulty: "medium",
        title: "Stream reader (batched)",
        sourceSlug: "py-stream-reader",
        lengthCategory: "medium",
        content: `from typing import Iterable, Iterator, TypeVar, Generic

T = TypeVar("T")

class Batch(Generic[T]):
    def __init__(self, source: Iterable[T], size: int) -> None:
        self._source = iter(source)
        self._size = max(1, size)

    def __iter__(self) -> Iterator[list[T]]:
        batch = []
        for item in self._source:
            batch.append(item)
            if len(batch) == self._size:
                yield batch
                batch = []
        if batch:
            yield batch`,
    }),
    defineSnippet({
        id: "java-logger-short",
        language: "java",
        difficulty: "easy",
        title: "Structured logger",
        sourceSlug: "java-logger",
        lengthCategory: "short",
        content: `package dev.codesprint.logging;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

public final class StructuredLogger {
    private final Map<String, Object> context = new HashMap<>();

    public StructuredLogger with(String key, Object value) {
        context.put(key, value);
        return this;
    }

    public void info(String message) {
        emit("info", message);
    }

    public void error(String message) {
        emit("error", message);
    }

    private void emit(String severity, String message) {
        Map<String, Object> payload = new HashMap<>(context);
        payload.put("ts", Instant.now().toString());
        payload.put("severity", severity);
        payload.put("message", message);
        System.out.println(payload);
    }
}`,
    }),
    defineSnippet({
        id: "java-logger-medium",
        language: "java",
        difficulty: "hard",
        title: "Structured logger (async)",
        sourceSlug: "java-logger",
        lengthCategory: "medium",
        content: `package dev.codesprint.logging;

import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;

public final class AsyncLogger extends StructuredLogger implements AutoCloseable {
    private final BlockingQueue<Runnable> queue = new LinkedBlockingQueue<>();
    private final Thread worker;
    private volatile boolean running = true;

    public AsyncLogger() {
        worker = new Thread(() -> {
            while (running || !queue.isEmpty()) {
                try {
                    queue.take().run();
                } catch (InterruptedException ignored) {
                }
            }
        });
        worker.start();
    }

    @Override
    public void info(String message) {
        queue.offer(() -> super.info(message));
    }

    @Override
    public void error(String message) {
        queue.offer(() -> super.error(message));
    }

    @Override
    public void close() {
        running = false;
        worker.interrupt();
    }
}`,
    }),
    defineSnippet({
        id: "js-document-buffer-long",
        language: "javascript",
        difficulty: "medium",
        title: "Collaborative document buffer",
        sourceSlug: "js-document-buffer",
        lengthCategory: "long",
        content: `type Listener = (text: string) => void;

export class DocumentBuffer {
    private lines: string[];
    private listeners = new Set<Listener>();

    constructor(text = "") {
        this.lines = text.split("\\n");
    }

    replace(range: { line: number; column: number; deleteCount: number; insert?: string }): string {
        const { line, column, deleteCount, insert = "" } = range;
        const current = this.lines[line] ?? "";
        const before = current.slice(0, column);
        const after = current.slice(column + deleteCount);
        this.lines[line] = before + insert + after;
        if (insert.includes("\\n")) {
            const [head, ...tail] = this.lines[line].split("\\n");
            this.lines.splice(line, 1, head, ...tail);
        }
        this.notify();
        return this.toString();
    }

    read(start = 0, end = this.lines.length): string {
        return this.lines.slice(start, end).join("\\n");
    }

    onChange(listener: Listener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notify() {
        const snapshot = this.toString();
        for (const listener of this.listeners) {
            listener(snapshot);
        }
    }

    toString(): string {
        return this.lines.join("\\n");
    }
}`,
    }),
    defineSnippet({
        id: "py-stream-reader-long",
        language: "python",
        difficulty: "hard",
        title: "Rolling statistics window",
        sourceSlug: "py-stream-reader",
        lengthCategory: "long",
        content: `from collections import deque
from dataclasses import dataclass, field
from statistics import mean
from typing import Deque, Iterable


@dataclass
class RollingStats:
    window: int
    _values: Deque[float] = field(default_factory=deque)
    _sum: float = 0.0
    _min: float | None = None
    _max: float | None = None

    def push(self, value: float) -> None:
        value = float(value)
        self._values.append(value)
        self._sum += value
        self._min = value if self._min is None else min(self._min, value)
        self._max = value if self._max is None else max(self._max, value)
        if len(self._values) > max(1, self.window):
            removed = self._values.popleft()
            self._sum -= removed
            if removed == self._min or removed == self._max:
                snapshot = list(self._values)
                self._min = min(snapshot, default=None)
                self._max = max(snapshot, default=None)

    def extend(self, values: Iterable[float]) -> None:
        for value in values:
            self.push(value)

    def average(self) -> float:
        if not self._values:
            raise RuntimeError("no samples available")
        return self._sum / len(self._values)

    def center(self) -> float:
        if not self._values:
            raise RuntimeError("no samples available")
        return mean(self._values)

    def bounds(self) -> tuple[float | None, float | None]:
        return self._min, self._max

    def snapshot(self) -> list[float]:
        return list(self._values)`,
    }),
    defineSnippet({
        id: "java-logger-long",
        language: "java",
        difficulty: "medium",
        title: "Token bucket rate limiter",
        sourceSlug: "java-logger",
        lengthCategory: "long",
        content: `package dev.codesprint.logging;

import java.time.Duration;
import java.util.Objects;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

public final class TokenBucket implements AutoCloseable {
    private final int capacity;
    private final AtomicInteger tokens = new AtomicInteger();
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();

    public TokenBucket(int capacity, Duration refillEvery) {
        this.capacity = Math.max(1, capacity);
        Objects.requireNonNull(refillEvery, "refillEvery");
        tokens.set(this.capacity);
        long period = Math.max(1L, refillEvery.toMillis());
        scheduler.scheduleAtFixedRate(() -> add(this.capacity / 2), period, period, TimeUnit.MILLISECONDS);
    }

    public boolean tryConsume(int amount) {
        if (amount <= 0) return true;
        while (true) {
            int available = tokens.get();
            if (available < amount) return false;
            if (tokens.compareAndSet(available, available - amount)) return true;
        }
    }

    public int available() {
        return tokens.get();
    }

    private void add(int amount) {
        if (amount <= 0) return;
        tokens.getAndUpdate(existing -> Math.min(capacity, existing + amount));
    }

    @Override
    public void close() {
        scheduler.shutdownNow();
    }
}`,
    }),
    defineSnippet({
        id: "cpp-ring-buffer",
        language: "cpp",
        difficulty: "medium",
        title: "Fixed-size ring buffer",
        sourceSlug: "cpp-ring-buffer",
        lengthCategory: "medium",
        content: `#include <array>
#include <cstddef>

template <typename T, std::size_t N>
class RingBuffer {
public:
    bool push(const T& value) {
        if (size_ == N) return false;
        data_[tail_] = value;
        tail_ = (tail_ + 1) % N;
        ++size_;
        return true;
    }

    bool pop(T& value) {
        if (size_ == 0) return false;
        value = data_[head_];
        head_ = (head_ + 1) % N;
        --size_;
        return true;
    }

    std::size_t size() const { return size_; }
    bool empty() const { return size_ == 0; }

private:
    std::array<T, N> data_{};
    std::size_t head_ = 0;
    std::size_t tail_ = 0;
    std::size_t size_ = 0;
};`,
    }),
];

const DATASET_SNIPPETS = normalizeDataset(leetcodeDataset);
const SOURCE_SNIPPETS =
    CURATED_SNIPPETS.length > 0
        ? [...CURATED_SNIPPETS, ...DATASET_SNIPPETS]
        : DATASET_SNIPPETS; // curated snippets guarantee usable content even if LeetCode data is filtered out
const PROBLEMS = buildProblems(SOURCE_SNIPPETS);

function normalizeDataset(raw: unknown): Snippet[] {
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((entry: DatasetSnippet): Snippet[] => {
        if (!entry || typeof entry !== "object") return [];
        if (!isSupportedLanguage(entry.lang)) return [];
        if (typeof entry.content !== "string" || entry.content.length === 0) return [];

        const sanitizedContent = sanitizeContentForLanguage(entry.content, entry.lang);
        const normalizedContent = normalizeContent(sanitizedContent);
        const lines =
            typeof entry.lines === "number" && Number.isFinite(entry.lines) ? entry.lines : countLines(normalizedContent);
        const lengthCategory = classifyLength(lines);
        const difficulty = isDifficulty(entry.difficulty) ? entry.difficulty : "easy";
        const title = typeof entry.title === "string" && entry.title.length > 0 ? entry.title : "LeetCode snippet";
        const sourceSlug = typeof entry.sourceSlug === "string" ? entry.sourceSlug : undefined;
        const fallbackProblemId =
            typeof entry.id === "string" && entry.id.length > 0 ? entry.id : computeProblemId(entry.lang, "snippet");
        const problemId =
            typeof entry.problemId === "string" && entry.problemId.length > 0
                ? entry.problemId
                : computeProblemId(entry.lang, sourceSlug ?? fallbackProblemId);
        const id = typeof entry.id === "string" && entry.id.length > 0 ? entry.id : problemId;
        const frontendId =
            typeof entry.frontendId === "number" && Number.isFinite(entry.frontendId) ? entry.frontendId : undefined;

        return [
            {
                id,
                problemId,
                title,
                content: normalizedContent,
                language: entry.lang,
                lengthCategory,
                difficulty,
                lines,
                sourceSlug,
                frontendId,
            },
        ];
    });
}

function defineSnippet(def: SnippetDefinition): Snippet {
    const sanitizedContent = sanitizeContentForLanguage(def.content, def.language);
    const normalizedContent = normalizeContent(sanitizedContent);
    const lines = countLines(normalizedContent);
    const lengthCategory = def.lengthCategory ?? classifyLength(lines);
    const sourceSlug = def.sourceSlug ?? def.id;
    return {
        id: def.id,
        problemId: computeProblemId(def.language, sourceSlug),
        title: def.title,
        content: normalizedContent,
        language: def.language,
        lengthCategory,
        difficulty: def.difficulty,
        lines,
        sourceSlug,
    };
}

function buildProblems(snippets: Snippet[]): Problem[] {
    const byProblem = new Map<string, Problem>();
    for (const snippet of snippets) {
        const existing = byProblem.get(snippet.problemId);
        if (!existing) {
            byProblem.set(snippet.problemId, {
                id: snippet.problemId,
                title: snippet.title,
                summary: snippet.sourceSlug ? `LeetCode • ${snippet.sourceSlug}` : snippet.title,
                language: snippet.language,
                availableLengths: [snippet.lengthCategory],
            });
        } else if (!existing.availableLengths.includes(snippet.lengthCategory)) {
            existing.availableLengths.push(snippet.lengthCategory);
            existing.availableLengths.sort((a, b) => LENGTH_ORDER[a] - LENGTH_ORDER[b]);
        }
    }
    return Array.from(byProblem.values()).sort((a, b) => a.title.localeCompare(b.title));
}

function matchesLength(lengths: SnippetLength[], requested?: SnippetLength) {
    if (!requested) return true;
    return lengths.includes(requested);
}

export function getProblems(language: SupportedLanguage, filters?: ProblemFilters): Problem[] {
    return PROBLEMS.filter(
        (problem) => problem.language === language && matchesLength(problem.availableLengths, filters?.length)
    );
}

export function getProblemSnippets(
    language: SupportedLanguage,
    problemId: string,
    filters?: SnippetFilters
): Snippet[] {
    return SOURCE_SNIPPETS.filter(
        (snippet) =>
            snippet.language === language &&
            snippet.problemId === problemId &&
            (filters?.length ? snippet.lengthCategory === filters.length : true)
    );
}

export function getSnippet(language: SupportedLanguage, filters?: SnippetFilters): Snippet {
    const preferred = SOURCE_SNIPPETS.find(
        (snippet) => snippet.language === language && (!filters?.length || snippet.lengthCategory === filters.length)
    );
    const fallback = SOURCE_SNIPPETS.find((snippet) => snippet.language === language) ?? SOURCE_SNIPPETS[0];
    return preferred ?? fallback;
}

function normalizeContent(content: string): string {
    const normalized = content.replace(/\r\n/g, "\n");
    const cleaned = condenseBlankRuns(normalized);
    const trimmed = cleaned.trimEnd();
    if (!trimmed) return "\n";
    return trimmed.endsWith("\n") ? trimmed : `${trimmed}\n`;
}

function sanitizeContentForLanguage(content: string, language: SupportedLanguage): string {
    if (language === "python") {
        return stripPythonDocstrings(content);
    }
    return content;
}

function stripPythonDocstrings(content: string): string {
    let index = 0;
    let result = "";
    const doubleQuote = '"""';
    const singleQuote = "'''";
    while (index < content.length) {
        const nextDouble = content.indexOf(doubleQuote, index);
        const nextSingle = content.indexOf(singleQuote, index);
        if (nextDouble === -1 && nextSingle === -1) {
            result += content.slice(index);
            break;
        }
        const useDouble = nextSingle === -1 || (nextDouble !== -1 && nextDouble <= nextSingle);
        const quote = useDouble ? doubleQuote : singleQuote;
        const start = useDouble ? nextDouble : nextSingle;
        if (start === -1) {
            result += content.slice(index);
            break;
        }
        const end = content.indexOf(quote, start + quote.length);
        if (end === -1) {
            result += content.slice(index);
            break;
        }
        const blockContent = content.slice(start + quote.length, end).toLowerCase();
        const shouldStrip = PYTHON_DOCSTRING_MARKERS.some((marker) => blockContent.includes(marker));
        if (shouldStrip) {
            const lastLineBreak = content.lastIndexOf("\n", start - 1);
            const lineStart = lastLineBreak === -1 ? 0 : lastLineBreak + 1;
            const leading = content.slice(lineStart, start);
            const keepUntil = /^[\t ]*$/.test(leading) ? lineStart : start;
            result += content.slice(index, keepUntil);
            index = end + quote.length;
            if (content[index] === "\r") {
                index += 1;
            }
            if (content[index] === "\n") {
                index += 1;
            }
            continue;
        }
        result += content.slice(index, end + quote.length);
        index = end + quote.length;
    }
    return result;
}

function condenseBlankRuns(content: string): string {
    const lines = content.split("\n");
    const result: string[] = [];
    let blankRun = 0;
    for (const line of lines) {
        const isBlank = line.trim().length === 0;
        if (isBlank) {
            blankRun += 1;
            if (result.length === 0) {
                continue; // drop leading blank lines
            }
            if (blankRun > 1) {
                continue; // limit to single blank line
            }
        } else {
            blankRun = 0;
        }
        result.push(line);
    }
    while (result.length > 0 && result[result.length - 1].trim().length === 0) {
        result.pop();
    }
    return result.join("\n");
}

function countLines(content: string): number {
    if (!content) return 0;
    return content.split("\n").length - 1;
}

function classifyLength(lines: number): SnippetLength {
    if (lines <= LENGTH_THRESHOLDS.short) return "short";
    if (lines <= LENGTH_THRESHOLDS.medium) return "medium";
    return "long";
}

function computeProblemId(language: SupportedLanguage, slug: string): string {
    return `${language}:${slug}`;
}

function isSupportedLanguage(value: unknown): value is SupportedLanguage {
    return value === "javascript" || value === "python" || value === "java" || value === "cpp";
}

function isDifficulty(value: unknown): value is Difficulty {
    return value === "easy" || value === "medium" || value === "hard";
}
