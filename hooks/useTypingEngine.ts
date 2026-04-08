import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { computeMetrics, createPatternScoreCalculator, type Metrics } from "@/lib/scoring";
import type { Snippet } from "@/lib/snippets";
import { tokenize } from "@/lib/tokenizer";
import { usePreferences } from "@/lib/preferences";

export type Phase = "idle" | "countdown" | "running" | "finished";

export type ErrorEntry = { expected: string; got: string; index: number };
export type HistoryEntry = { time: number; wpm: number; raw: number; errors: number; burst: number };

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
    // Published snapshot for React consumers (updated on tick + phase change)
    const [publishedWrongChars, setPublishedWrongChars] = useState<Set<number>>(new Set());
    const publishWrongChars = useCallback(() => {
        setPublishedWrongChars(new Set(wrongCharsRef.current));
    }, []);

    const [startTime, setStartTime] = useState<number | null>(null);
    const [now, setNow] = useState<number>(Date.now());
    const [lastErrorAt, setLastErrorAt] = useState<number | null>(null);
    const [errorLog, setErrorLog] = useState<ErrorEntry[]>([]);
    const [totalTypedChars, setTotalTypedChars] = useState(0);
    const [totalKeystrokes, setTotalKeystrokes] = useState(0);
    const [correctKeystrokes, setCorrectKeystrokes] = useState(0);

    const phaseRef = useRef(phase);
    const startTimeRef = useRef(startTime);
    const cursorIndexRef = useRef(cursorIndex);
    const snippetRef = useRef(snippet);

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

    // Timer tick & History update
    useEffect(() => {
        if (phase !== "running") return;

        const id = setInterval(() => {
            const nowTs = Date.now();
            setNow(nowTs);
            publishWrongChars();
        }, 100);

        return () => {
            clearInterval(id);
        };
    }, [phase, publishWrongChars]);

    // We need refs for history tracking to avoid restarting interval
    const statsRef = useRef({ cursorIndex: 0, totalKeystrokes: 0, correctKeystrokes: 0, wrongCharsSize: 0, lastKeystrokes: 0 });
    useEffect(() => {
        statsRef.current = { ...statsRef.current, cursorIndex, totalKeystrokes, correctKeystrokes, wrongCharsSize: wrongCharsRef.current.size };
    }, [cursorIndex, totalKeystrokes, correctKeystrokes]);

    // Separate effect for history to avoid complex dependencies
    useEffect(() => {
        if (phase !== "running") return;

        const historyId = setInterval(() => {
            const start = startTimeRef.current;
            if (!start) return;

            const nowTs = Date.now();
            const elapsed = nowTs - start;
            if (elapsed < 1000) return;

            const { cursorIndex, totalKeystrokes, wrongCharsSize, lastKeystrokes } = statsRef.current;

            const minutes = elapsed / MS_PER_MINUTE;
            const rawWpm = Math.round((totalKeystrokes / WORD_LENGTH_CHARS) / minutes);
            // Approximate net wpm for history (using simple correct chars count for smoothness in graph)
            // For the live stat we use the strict "perfect word" logic, but for history graph 
            // a smoother approximation (cursor - errors) is often preferred to avoid jagged drops.
            // However, to be consistent, we should ideally use the same logic. 
            // But calculating perfect words inside this interval without access to full state/snippet is hard.
            // Let's stick to the previous approximation for the graph for now, or use correctKeystrokes.
            const netWpm = Math.max(0, Math.round(((cursorIndex - wrongCharsSize) / WORD_LENGTH_CHARS) / minutes));

            // Burst: Instantaneous Raw WPM over the last second
            // We track lastKeystrokes in the ref
            const keystrokesDelta = totalKeystrokes - lastKeystrokes;
            const burst = Math.round((keystrokesDelta / WORD_LENGTH_CHARS) * 60);

            // Update lastKeystrokes for next tick
            statsRef.current.lastKeystrokes = totalKeystrokes;

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
        setPhase("idle");
        setCountdown(null);
        setCursorIndex(0);
        wrongCharsRef.current = new Set();
        setPublishedWrongChars(new Set());
        setStartTime(null);
        setNow(Date.now());
        setLastErrorAt(null);
        setErrorLog([]);
        setTotalTypedChars(0);
        setTotalKeystrokes(0);
        setCorrectKeystrokes(0);
        setHistory([]);
    }, []);

    // ... (rest of existing code)



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

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
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
                setTotalTypedChars(prev => prev + auto.advanced);
                for (let i = startIndex; i < advancedIndex; i++) wrongCharsRef.current.delete(i);

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
                setTotalTypedChars(prev => prev + advanced);
                // Manual tab is a correct action
                setCorrectKeystrokes(prev => prev + 1);
                for (let i = 0; i < advanced; i++) wrongCharsRef.current.delete(startIndex + i);
                return;
            }

            // 3. Manual Tab (literal tab character)
            const expected = content[startIndex];
            if (expected === "\t") {
                cursorIndexRef.current = startIndex + 1;
                setCursorIndex(cursorIndexRef.current);
                setTotalTypedChars(prev => prev + 1);
                setCorrectKeystrokes(prev => prev + 1);
                wrongCharsRef.current.delete(startIndex);
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
        setTotalKeystrokes(prev => prev + 1);

        if (e.key === "Backspace") {
            if (phaseNow === "finished") {
                setPhase("running");
            }
            swallowEvent();
            const currentCursor = cursorIndexRef.current;
            if (currentCursor === 0) return;

            const targetIndex = currentCursor - 1;
            cursorIndexRef.current = targetIndex;
            setCursorIndex(targetIndex);
            wrongCharsRef.current.delete(targetIndex);
            return;
        }

        // Regular typing
        const { nextIndex: currentIndex, advanced } = autoAdvanceIndentationIfAllowed(cursorIndexRef.current);

        // If auto-advance happened
        if (advanced > 0) {
            cursorIndexRef.current = currentIndex;
            setCursorIndex(currentIndex);
            setTotalTypedChars(prev => prev + advanced);
            for (let i = currentIndex - advanced; i < currentIndex; i++) wrongCharsRef.current.delete(i);
        }

        const expected = snippetRef.current.content[currentIndex];
        if (expected === undefined) return;

        swallowEvent();

        const got = e.key === "Enter" ? "\n" : e.key;
        const ok = normalizeWhitespace(got) === normalizeWhitespace(expected);

        const newCursor = currentIndex + 1;
        cursorIndexRef.current = newCursor;
        setCursorIndex(newCursor);
        setTotalTypedChars(prev => prev + 1);

        if (ok) {
            setCorrectKeystrokes(prev => prev + 1);
            wrongCharsRef.current.delete(currentIndex);
        } else {
            wrongCharsRef.current.add(currentIndex);
            setLastErrorAt(timestamp);
            setNow(timestamp);
            setErrorLog(prev => {
                const next = [...prev, { expected, got, index: currentIndex }];
                if (next.length > 200) next.shift();
                return next;
            });
        }

        if (shouldFinishAtIndex(newCursor, snippetRef.current.content)) {
            publishWrongChars();
            setPhase("finished");
            if (onFinish) onFinish();
        }

    }, [autoAdvanceIndentationIfAllowed, onFinish, preferences.vimMode, publishWrongChars]);

    const elapsedMs = startTime ? now - startTime : 0;

    // Memoized initial metrics (only computed once for useState initial value)
    const [publishedMetrics, setPublishedMetrics] = useState<Metrics>(() => ({
        rawWpm: 0,
        adjustedWpm: 0,
        accuracy: 1,
    }));

    // Ref to track latest values for metrics calculation without triggering re-renders
    const metricsInputRef = useRef({
        cursorIndex: 0,
        wrongChars: new Set<number>(),
        snippetContent: snippet.content,
        snippetRef: snippet,
        startTime: null as number | null,
        totalTypedChars: 0,
        totalKeystrokes: 0,
        correctKeystrokes: 0,
        errorLog: [] as ErrorEntry[],
    });

    // Keep ref in sync (doesn't trigger re-renders)
    useEffect(() => {
        metricsInputRef.current = {
            cursorIndex,
            wrongChars: wrongCharsRef.current,
            snippetContent: snippet.content,
            snippetRef: snippet,
            startTime,
            totalTypedChars,
            totalKeystrokes,
            correctKeystrokes,
            errorLog,
        };
    }, [cursorIndex, snippet, startTime, totalTypedChars, totalKeystrokes, correctKeystrokes, errorLog]);

    // Cache the pattern score calculator per snippet — rebuilding categoryMap on
    // every 1.5s tick is wasteful since tokens and weights never change mid-snippet.
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

    // Helper to calculate and publish metrics (only when called)
    const calculateAndPublishMetrics = useCallback(() => {
        const { cursorIndex: idx, snippetContent, startTime: start, totalTypedChars: typed, totalKeystrokes: strokes, correctKeystrokes: correct, errorLog: errorLogEntries } = metricsInputRef.current;
        const wrongChars = wrongCharsRef.current;

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

        const nowTs = Date.now();
        const elapsed = start ? nowTs - start : 0;
        const metrics = computeMetrics({
            correctProgress: perfectChars,
            elapsedMs: elapsed,
            totalTyped: typed,
            totalKeystrokes: strokes,
            correctKeystrokes: correct,
        });

        // Use the cached calculator — avoids rebuilding categoryMap every tick
        const errorPositions = errorLogEntries.map((e) => e.index);
        metrics.patternScore = patternCalculatorRef.current(errorPositions);

        setPublishedMetrics(metrics);
    }, []);

    // Interval-based metrics publishing (every 1.5s during running phase)
    useEffect(() => {
        if (phase !== "running") return;

        // Publish immediately when entering running phase
        calculateAndPublishMetrics();

        const intervalId = setInterval(() => {
            calculateAndPublishMetrics();
        }, 1500);

        return () => clearInterval(intervalId);
    }, [phase, calculateAndPublishMetrics]);

    // Publish final metrics on phase change to finished/idle
    useEffect(() => {
        if (phase === "finished" || phase === "idle") {
            calculateAndPublishMetrics();
        }
    }, [phase, calculateAndPublishMetrics]);

    // Safety net: publish wrongChars on phase transition (covers edge cases
    // like setPhase("finished") called externally via the exposed setPhase).
    // The primary synchronous publish happens inside handleKeyDown before setPhase.
    useEffect(() => {
        if (phase === "finished" || phase === "idle") {
            publishWrongChars();
        }
    }, [phase, publishWrongChars]);

    const caretErrorActive = lastErrorAt !== null && now >= lastErrorAt && now - lastErrorAt < 600;

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
        reset,
        start,
        handleKeyDown,
        setPhase, // Exposed for edge cases like "Escape" handled outside or "R"
    };
}
