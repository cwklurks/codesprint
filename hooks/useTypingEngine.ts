import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { computeMetrics, createPatternScoreCalculator, type Metrics } from "@/lib/scoring";
import type { Snippet } from "@/lib/snippets";
import { tokenize } from "@/lib/tokenizer";
import { usePreferences } from "@/lib/preferences";

export type Phase = "idle" | "countdown" | "running" | "finished";

export type ErrorEntry = { expected: string; got: string; index: number };
export type HistoryEntry = {
    time: number;
    /** Smooth net graph WPM snapshot; final score uses metrics.adjustedWpm. */
    wpm: number;
    raw: number;
    errors: number;
    burst: number;
};

/**
 * Immutable, atomic picture of a finished run.
 *
 * Published in the SAME state batch as `phase = "finished"`, so every finish
 * consumer (lifecycle persistence, achievements, the result screen) reads one
 * consistent sample. Before this existed, the final metrics were published from
 * an effect one commit AFTER the phase flipped, and the lifecycle save guard
 * latched on the earlier commit — persisting a metrics sample up to ~200 ms old.
 *
 * `elapsedMs` is the exact keystroke-to-keystroke duration, not a value
 * truncated to the last timer tick.
 */
export type FinalSessionSnapshot = {
    elapsedMs: number;
    metrics: Metrics;
    wrongChars: Set<number>;
    errorLog: ErrorEntry[];
    history: HistoryEntry[];
    cursorIndex: number;
    totalKeystrokes: number;
    correctKeystrokes: number;
};

/** How long the caret shows its error state after a wrong keystroke. */
const CARET_ERROR_MS = 600;

function normalizeWhitespace(ch: string) {
    return ch === "\r" ? "\n" : ch;
}

function shouldFinishAtIndex(nextIndex: number, content: string) {
    const isEnd = nextIndex >= content.length;
    const isTrailingNewline = nextIndex === content.length - 1 && content[nextIndex] === "\n";

    return isEnd || isTrailingNewline;
}

type UseTypingEngineProps = {
    snippet: Snippet;
    onFinish?: () => void;
};

import { MS_PER_MINUTE, WORD_LENGTH_CHARS } from "@/lib/constants";

export function useTypingEngine({ snippet, onFinish }: UseTypingEngineProps) {
    const { preferences } = usePreferences();
    const INDENT_WIDTH = 4;

    const [phase, setPhase] = useState<Phase>("idle");
    const [countdown, setCountdown] = useState<number | null>(null);
    const [cursorIndex, setCursorIndex] = useState(0);
    // Mutable ref for O(1) updates during keystrokes (no Set cloning)
    const wrongCharsRef = useRef(new Set<number>());
    // Published snapshot for React consumers. It used to be re-cloned 10x/sec by a
    // timer, which re-ran Monaco's deltaDecorations for nothing; now it is cloned
    // only when the set actually gains or loses a member.
    const [publishedWrongChars, setPublishedWrongChars] = useState<Set<number>>(new Set());
    const wrongCharsDirtyRef = useRef(false);

    const markWrong = useCallback((index: number) => {
        if (wrongCharsRef.current.has(index)) return;
        wrongCharsRef.current.add(index);
        wrongCharsDirtyRef.current = true;
    }, []);

    const clearWrong = useCallback((index: number) => {
        if (!wrongCharsRef.current.delete(index)) return;
        wrongCharsDirtyRef.current = true;
    }, []);

    const publishWrongChars = useCallback(() => {
        if (!wrongCharsDirtyRef.current) return;
        wrongCharsDirtyRef.current = false;
        setPublishedWrongChars(new Set(wrongCharsRef.current));
    }, []);

    const [startTime, setStartTime] = useState<number | null>(null);
    const [now, setNow] = useState<number>(() => Date.now());
    const [caretErrorActive, setCaretErrorActive] = useState(false);
    const [errorLog, setErrorLog] = useState<ErrorEntry[]>([]);
    const [totalKeystrokes, setTotalKeystrokes] = useState(0);
    const [correctKeystrokes, setCorrectKeystrokes] = useState(0);

    const phaseRef = useRef(phase);
    const startTimeRef = useRef(startTime);
    const cursorIndexRef = useRef(cursorIndex);
    const snippetRef = useRef(snippet);
    // Counters mirrored SYNCHRONOUSLY alongside their setState calls so metrics can
    // be computed inside the keystroke handler (React state is one commit behind).
    const countersRef = useRef({ totalTypedChars: 0, totalKeystrokes: 0, correctKeystrokes: 0 });
    const errorLogRef = useRef<ErrorEntry[]>([]);
    const historyRef = useRef<HistoryEntry[]>([]);
    const lastKeystrokesRef = useRef(0);
    const caretErrorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        phaseRef.current = phase;
    }, [phase]);

    useEffect(() => {
        startTimeRef.current = startTime;
    }, [startTime]);

    // NOTE: cursorIndexRef is updated SYNCHRONOUSLY inside handleKeyDown
    // (not via useEffect) to avoid a race condition where rapid keystrokes
    // read a stale ref before React's deferred effects run.
    // The reset() callback also updates it synchronously.

    useEffect(() => {
        snippetRef.current = snippet;
    }, [snippet]);

    // History tracking
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [finalSnapshot, setFinalSnapshot] = useState<FinalSessionSnapshot | null>(null);
    const finalSnapshotRef = useRef<FinalSessionSnapshot | null>(null);

    useEffect(() => {
        historyRef.current = history;
    }, [history]);

    const clearCaretErrorTimeout = useCallback(() => {
        if (caretErrorTimeoutRef.current !== null) {
            clearTimeout(caretErrorTimeoutRef.current);
            caretErrorTimeoutRef.current = null;
        }
    }, []);

    // A single timeout replaces the old 100 ms "is the error still fresh?" polling.
    const flagCaretError = useCallback(() => {
        clearCaretErrorTimeout();
        setCaretErrorActive(true);
        caretErrorTimeoutRef.current = setTimeout(() => {
            caretErrorTimeoutRef.current = null;
            setCaretErrorActive(false);
        }, CARET_ERROR_MS);
    }, [clearCaretErrorTimeout]);

    useEffect(() => clearCaretErrorTimeout, [clearCaretErrorTimeout]);

    // Per-second history sampling. This is the only timer left running during a
    // run — the old 100 ms tick published wrongChars and a clock value that
    // nothing displayed.
    useEffect(() => {
        if (phase !== "running") return;

        const historyId = setInterval(() => {
            const start = startTimeRef.current;
            if (!start) return;

            const nowTs = Date.now();
            setNow(nowTs);
            const elapsed = nowTs - start;
            if (elapsed < 1000) return;

            const cursor = cursorIndexRef.current;
            const strokes = countersRef.current.totalKeystrokes;
            const wrongCharsSize = wrongCharsRef.current.size;

            const minutes = elapsed / MS_PER_MINUTE;
            const rawWpm = Math.round((strokes / WORD_LENGTH_CHARS) / minutes);
            // Smooth net graph WPM. Final result scoring uses the stricter
            // adjustedWpm metric from computeMetrics.
            const netWpm = Math.max(0, Math.round(((cursor - wrongCharsSize) / WORD_LENGTH_CHARS) / minutes));

            // Burst: Instantaneous Raw WPM over the last second
            const keystrokesDelta = strokes - lastKeystrokesRef.current;
            const burst = Math.round((keystrokesDelta / WORD_LENGTH_CHARS) * 60);

            lastKeystrokesRef.current = strokes;

            setHistory(prev => {
                const timePoint = Math.floor(elapsed / 1000);
                // Avoid duplicate seconds
                if (prev.length > 0 && prev[prev.length - 1].time === timePoint) return prev;

                return [...prev, {
                    time: timePoint,
                    wpm: netWpm,
                    raw: rawWpm,
                    errors: wrongCharsSize,
                    burst
                }];
            });
        }, 1000);

        return () => clearInterval(historyId);
    }, [phase]);

    const reset = useCallback(() => {
        phaseRef.current = "idle";
        cursorIndexRef.current = 0;
        startTimeRef.current = null;
        countersRef.current = { totalTypedChars: 0, totalKeystrokes: 0, correctKeystrokes: 0 };
        errorLogRef.current = [];
        historyRef.current = [];
        lastKeystrokesRef.current = 0;
        finalSnapshotRef.current = null;
        wrongCharsRef.current = new Set();
        wrongCharsDirtyRef.current = false;
        clearCaretErrorTimeout();
        setPhase("idle");
        setCountdown(null);
        setCursorIndex(0);
        setPublishedWrongChars(new Set());
        setStartTime(null);
        setNow(Date.now());
        setCaretErrorActive(false);
        setErrorLog([]);
        setTotalKeystrokes(0);
        setCorrectKeystrokes(0);
        setHistory([]);
        setFinalSnapshot(null);
    }, [clearCaretErrorTimeout]);

    const start = useCallback(() => {
        if (preferences.countdownEnabled) {
            setPhase("countdown");
            setCountdown(3);
        } else {
            setPhase("running");
            setStartTime(Date.now());
            setNow(Date.now());
        }
    }, [preferences.countdownEnabled]);

    // Countdown timer effect
    useEffect(() => {
        if (phase !== "countdown" || countdown === null) return;

        const intervalId = setInterval(() => {
            setCountdown((prev) => {
                if (prev === null) return null;
                if (prev <= 1) {
                    // Countdown finished, transition to running
                    setPhase("running");
                    const ts = Date.now();
                    setStartTime(ts);
                    setNow(ts);
                    return null;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(intervalId);
    }, [phase, countdown]);

    // Cache the pattern score calculator per snippet — rebuilding categoryMap on
    // every tick is wasteful since tokens and weights never change mid-snippet.
    const patternCalculator = useMemo(() => {
        const tokens = snippet.tokens ?? tokenize(snippet.content, snippet.language);
        return createPatternScoreCalculator({
            tokens,
            contentLength: snippet.content.length,
            language: snippet.language,
        });
    }, [snippet]);

    const patternCalculatorRef = useRef(patternCalculator);
    useEffect(() => {
        patternCalculatorRef.current = patternCalculator;
    }, [patternCalculator]);

    // Pure metric computation from the synchronous refs, for an explicit elapsed.
    const buildMetrics = useCallback((elapsed: number): Metrics => {
        const idx = cursorIndexRef.current;
        const snippetContent = snippetRef.current.content;
        const wrongChars = wrongCharsRef.current;
        const { totalTypedChars: typed, totalKeystrokes: strokes, correctKeystrokes: correct } = countersRef.current;

        // Calculate getPerfectWordChars
        let perfectChars = 0;
        let wordStart = 0;
        for (let i = 0; i <= idx; i++) {
            const char = snippetContent[i];
            const isWordEnd = i === snippetContent.length || char === " " || char === "\n" || char === "\t";
            if (isWordEnd) {
                if (i <= idx) {
                    let isPerfect = true;
                    for (let j = wordStart; j < i; j++) {
                        if (wrongChars.has(j)) {
                            isPerfect = false;
                            break;
                        }
                    }
                    if (isPerfect && i > wordStart) {
                        perfectChars += (i - wordStart);
                        if (i < idx && !wrongChars.has(i)) {
                            perfectChars += 1;
                        }
                    }
                }
                wordStart = i + 1;
            }
        }

        const metrics = computeMetrics({
            correctProgress: perfectChars,
            elapsedMs: elapsed,
            totalTyped: typed,
            totalKeystrokes: strokes,
            correctKeystrokes: correct,
        });

        // Use the cached calculator — avoids rebuilding categoryMap every tick
        metrics.patternScore = patternCalculatorRef.current(errorLogRef.current.map((e) => e.index));

        return metrics;
    }, []);

    const [publishedMetrics, setPublishedMetrics] = useState<Metrics>(() => ({
        rawWpm: 0,
        adjustedWpm: 0,
        accuracy: 1,
    }));

    const calculateAndPublishMetrics = useCallback(() => {
        const start = startTimeRef.current;
        const elapsed = start ? Date.now() - start : 0;
        setPublishedMetrics(buildMetrics(elapsed));
    }, [buildMetrics]);

    /**
     * Build and publish the final snapshot. Everything below lands in ONE React
     * batch, so the commit that first reports `phase === "finished"` already
     * carries the final metrics, wrongChars and exact elapsed time.
     */
    const finishRun = useCallback((finishedAt: number) => {
        const start = startTimeRef.current;
        const elapsed = start ? Math.max(0, finishedAt - start) : 0;
        const wrongChars = new Set(wrongCharsRef.current);
        const snapshot: FinalSessionSnapshot = Object.freeze({
            elapsedMs: elapsed,
            metrics: buildMetrics(elapsed),
            wrongChars,
            errorLog: [...errorLogRef.current],
            history: [...historyRef.current],
            cursorIndex: cursorIndexRef.current,
            totalKeystrokes: countersRef.current.totalKeystrokes,
            correctKeystrokes: countersRef.current.correctKeystrokes,
        });

        finalSnapshotRef.current = snapshot;
        phaseRef.current = "finished";
        wrongCharsDirtyRef.current = false;

        setFinalSnapshot(snapshot);
        setPublishedMetrics(snapshot.metrics);
        setPublishedWrongChars(wrongChars);
        setPhase("finished");
    }, [buildMetrics]);

    // Auto-advance indentation logic
    const autoAdvanceIndentationIfAllowed = useCallback((index: number): { advanced: number; nextIndex: number } => {
        const content = snippetRef.current.content;
        if (!content || content.length === 0) {
            return { advanced: 0, nextIndex: index };
        }
        const previousChar = index === 0 ? "\n" : content[index - 1];
        if (index !== 0 && previousChar !== "\n" && previousChar !== "\r") {
            return { advanced: 0, nextIndex: index };
        }
        let target = index;
        while (target < content.length) {
            const ch = content[target];
            if (ch !== " " && ch !== "\t") break;
            target += 1;
        }
        const advanced = target - index;
        if (advanced === 0) {
            return { advanced: 0, nextIndex: index };
        }
        const nextChar = content[target];
        const isBlankLine = nextChar === "\n" || nextChar === "\r" || typeof nextChar === "undefined";
        if (preferences.requireTabForIndent && !isBlankLine) {
            return { advanced: 0, nextIndex: index };
        }

        // Side effects are tricky in a pure function, but this is a helper for the event handler
        // We will return the values and let the handler apply updates
        return { advanced, nextIndex: target };
    }, [preferences.requireTabForIndent]);

    const processKeyDown = useCallback((e: KeyboardEvent) => {
        const phaseNow = phaseRef.current;
        const allowVimPropagation = preferences.vimMode;

        const swallowEvent = () => {
            if (!allowVimPropagation) {
                e.preventDefault();
                e.stopPropagation();
            }
        };

        // Ignore modifiers
        if (e.key === "Meta" || e.key === "Alt" || e.key === "Control") return;

        // Handle Tab
        if (e.key === "Tab") {
            swallowEvent();

            if (phaseNow === "finished") return;

            // During countdown, ignore Tab (let countdown finish automatically)
            if (phaseNow === "countdown") {
                swallowEvent();
                return;
            }

            if (phaseNow === "idle") {
                // Update ref immediately to prevent race conditions with rapid keystrokes
                phaseRef.current = "running";
                setPhase("running");
                setCountdown(null);
                if (!startTimeRef.current) {
                    const ts = Date.now();
                    startTimeRef.current = ts;
                    setStartTime(ts);
                    setNow(ts);
                }
            }

            // Tab counts as a keystroke? Usually yes.
            countersRef.current.totalKeystrokes += 1;
            setTotalKeystrokes(prev => prev + 1);

            const startIndex = cursorIndexRef.current;
            const content = snippetRef.current.content;
            if (startIndex >= content.length) return;

            // 1. Auto-advance check
            const auto = autoAdvanceIndentationIfAllowed(startIndex);
            if (auto.advanced > 0) {
                const advancedIndex = auto.nextIndex;

                // Apply updates for auto-advance
                cursorIndexRef.current = advancedIndex;
                setCursorIndex(advancedIndex);
                countersRef.current.totalTypedChars += auto.advanced;
                for (let i = startIndex; i < advancedIndex; i++) clearWrong(i);

                return;
            }

            // 2. Manual Tab (spaces)
            let advanced = 0;
            while (
                advanced < INDENT_WIDTH &&
                startIndex + advanced < content.length &&
                content[startIndex + advanced] === " "
            ) {
                advanced += 1;
            }

            if (advanced > 0) {
                cursorIndexRef.current = startIndex + advanced;
                setCursorIndex(cursorIndexRef.current);
                countersRef.current.totalTypedChars += advanced;
                // Manual tab is a correct action
                countersRef.current.correctKeystrokes += 1;
                setCorrectKeystrokes(prev => prev + 1);
                for (let i = 0; i < advanced; i++) clearWrong(startIndex + i);
                return;
            }

            // 3. Manual Tab (literal tab character)
            const expected = content[startIndex];
            if (expected === "\t") {
                cursorIndexRef.current = startIndex + 1;
                setCursorIndex(cursorIndexRef.current);
                countersRef.current.totalTypedChars += 1;
                countersRef.current.correctKeystrokes += 1;
                setCorrectKeystrokes(prev => prev + 1);
                clearWrong(startIndex);
            }
            return;
        }

        const actionable = e.key === "Backspace" || e.key === "Enter" || e.key.length === 1;
        if (!actionable) return;

        const timestamp = Date.now();

        if (phaseNow === "finished" && e.key !== "Backspace") {
            swallowEvent();
            return;
        }

        // During countdown, ignore all typing keys (let countdown finish automatically)
        if (phaseNow === "countdown") {
            swallowEvent();
            return;
        }

        if (phaseNow === "idle") {
            // Update ref immediately to prevent race conditions with rapid keystrokes
            phaseRef.current = "running";
            setPhase("running");
            setCountdown(null);
            if (!startTimeRef.current) {
                const ts = timestamp;
                startTimeRef.current = ts;
                setStartTime(ts);
                setNow(ts);
            }
        }

        // Count every actionable key press as a keystroke
        countersRef.current.totalKeystrokes += 1;
        setTotalKeystrokes(prev => prev + 1);

        if (e.key === "Backspace") {
            if (phaseNow === "finished") {
                phaseRef.current = "running";
                setPhase("running");
            }
            swallowEvent();
            const currentCursor = cursorIndexRef.current;
            if (currentCursor === 0) return;

            const targetIndex = currentCursor - 1;
            cursorIndexRef.current = targetIndex;
            setCursorIndex(targetIndex);
            clearWrong(targetIndex);
            return;
        }

        // Regular typing
        const { nextIndex: currentIndex, advanced } = autoAdvanceIndentationIfAllowed(cursorIndexRef.current);

        // If auto-advance happened
        if (advanced > 0) {
            cursorIndexRef.current = currentIndex;
            setCursorIndex(currentIndex);
            countersRef.current.totalTypedChars += advanced;
            for (let i = currentIndex - advanced; i < currentIndex; i++) clearWrong(i);
        }

        const expected = snippetRef.current.content[currentIndex];
        // Always swallow the key (even past the end of the snippet) so it never reaches
        // Monaco — otherwise a keystroke after the cursor passes content.length triggers
        // Monaco's "Cannot edit in read-only editor" message at its hidden cursor.
        swallowEvent();
        if (expected === undefined) return;

        const got = e.key === "Enter" ? "\n" : e.key;
        const ok = normalizeWhitespace(got) === normalizeWhitespace(expected);

        const newCursor = currentIndex + 1;
        cursorIndexRef.current = newCursor;
        setCursorIndex(newCursor);
        countersRef.current.totalTypedChars += 1;

        if (ok) {
            countersRef.current.correctKeystrokes += 1;
            setCorrectKeystrokes(prev => prev + 1);
            clearWrong(currentIndex);
        } else {
            markWrong(currentIndex);
            flagCaretError();
            const nextErrors = [...errorLogRef.current, { expected, got, index: currentIndex }];
            if (nextErrors.length > 200) nextErrors.shift();
            errorLogRef.current = nextErrors;
            setErrorLog(nextErrors);
        }

        if (shouldFinishAtIndex(newCursor, snippetRef.current.content)) {
            finishRun(timestamp);
            if (onFinish) onFinish();
        }
    }, [autoAdvanceIndentationIfAllowed, clearWrong, finishRun, flagCaretError, markWrong, onFinish, preferences.vimMode]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        processKeyDown(e);
        // One clone per real change to the wrong-char set, instead of one per tick.
        publishWrongChars();
    }, [processKeyDown, publishWrongChars]);

    // Interval-based metrics publishing during running phase. ~200ms so the
    // live WPM climbs continuously instead of lurching every 1.5s; computeMetrics
    // is cheap arithmetic and patternScore is memoized per snippet.
    useEffect(() => {
        if (phase !== "running") return;

        // Publish immediately when entering running phase
        calculateAndPublishMetrics();

        const intervalId = setInterval(() => {
            calculateAndPublishMetrics();
        }, 200);

        return () => clearInterval(intervalId);
    }, [phase, calculateAndPublishMetrics]);

    // Drop the snapshot as soon as the run is no longer finished (reset, or a
    // backspace that reopens the run) so a later finish builds a fresh one.
    useEffect(() => {
        if (phase === "finished") return;
        if (finalSnapshotRef.current === null) return;
        finalSnapshotRef.current = null;
        setFinalSnapshot(null);
    }, [phase]);

    // Safety net for finishes that did not come from a keystroke (the exposed
    // setPhase). The keystroke path has already published its snapshot, so this
    // never recomputes — and therefore never nudges the exact elapsed time.
    useEffect(() => {
        if (phase === "finished") {
            if (!finalSnapshotRef.current) finishRun(Date.now());
            return;
        }
        if (phase === "idle") {
            calculateAndPublishMetrics();
        }
    }, [phase, calculateAndPublishMetrics, finishRun]);

    const elapsedMs = finalSnapshot
        ? finalSnapshot.elapsedMs
        : startTime
            ? Math.max(0, now - startTime)
            : 0;

    return {
        phase,
        countdown,
        cursorIndex,
        wrongChars: publishedWrongChars,
        metrics: publishedMetrics,
        elapsedMs,
        errorLog,
        caretErrorActive,
        history,
        totalKeystrokes,
        correctKeystrokes,
        /** Atomic final sample; null until the current run finishes. */
        finalSnapshot,
        reset,
        start,
        handleKeyDown,
        setPhase, // Exposed for edge cases like "Escape" handled outside or "R"
    };
}
