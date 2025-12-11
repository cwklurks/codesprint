import { useCallback, useEffect, useRef, useState } from "react";
import { computeMetrics, type Metrics } from "@/lib/scoring";
import type { Snippet } from "@/lib/snippets";
import { usePreferences } from "@/lib/preferences";

export type Phase = "idle" | "countdown" | "running" | "finished";

type ErrorEntry = { expected: string; got: string; index: number };

function normalizeWhitespace(ch: string) {
    return ch === "\r" ? "\n" : ch;
}

type UseTypingEngineProps = {
    snippet: Snippet;
    onFinish?: () => void;
};

export function useTypingEngine({ snippet, onFinish }: UseTypingEngineProps) {
    const { preferences } = usePreferences();
    const INDENT_WIDTH = 4;

    const [phase, setPhase] = useState<Phase>("idle");
    const [countdown, setCountdown] = useState<number | null>(null);
    const [cursorIndex, setCursorIndex] = useState(0);
    const [wrongChars, setWrongChars] = useState<Set<number>>(new Set());
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

    useEffect(() => {
        cursorIndexRef.current = cursorIndex;
    }, [cursorIndex]);

    useEffect(() => {
        snippetRef.current = snippet;
    }, [snippet]);

    // History tracking
    const [history, setHistory] = useState<Array<{ time: number; wpm: number; raw: number; errors: number; burst: number }>>([]);

    // Timer tick & History update
    useEffect(() => {
        if (phase !== "running") return;

        const id = setInterval(() => {
            const nowTs = Date.now();
            setNow(nowTs);
        }, 100);

        return () => {
            clearInterval(id);
        };
    }, [phase]);

    // We need refs for history tracking to avoid restarting interval
    const statsRef = useRef({ cursorIndex: 0, totalKeystrokes: 0, correctKeystrokes: 0, wrongCharsSize: 0, lastKeystrokes: 0 });
    useEffect(() => {
        statsRef.current = { ...statsRef.current, cursorIndex, totalKeystrokes, correctKeystrokes, wrongCharsSize: wrongChars.size };
    }, [cursorIndex, totalKeystrokes, correctKeystrokes, wrongChars]);

    // Separate effect for history to avoid complex dependencies
    useEffect(() => {
        if (phase !== "running") return;

        const historyId = setInterval(() => {
            const start = startTimeRef.current;
            if (!start) return;

            const nowTs = Date.now();
            const elapsed = nowTs - start;
            if (elapsed < 1000) return;

            const { cursorIndex, totalKeystrokes, correctKeystrokes, wrongCharsSize, lastKeystrokes } = statsRef.current;

            const minutes = elapsed / 60000;
            const rawWpm = Math.round((totalKeystrokes / 5) / minutes);
            // Approximate net wpm for history (using simple correct chars count for smoothness in graph)
            // For the live stat we use the strict "perfect word" logic, but for history graph 
            // a smoother approximation (cursor - errors) is often preferred to avoid jagged drops.
            // However, to be consistent, we should ideally use the same logic. 
            // But calculating perfect words inside this interval without access to full state/snippet is hard.
            // Let's stick to the previous approximation for the graph for now, or use correctKeystrokes.
            const netWpm = Math.max(0, Math.round(((cursorIndex - wrongCharsSize) / 5) / minutes));

            // Burst: Instantaneous Raw WPM over the last second
            // We track lastKeystrokes in the ref
            const keystrokesDelta = totalKeystrokes - lastKeystrokes;
            const burst = Math.round((keystrokesDelta / 5) * 60);

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
        console.log("Engine reset called");
        setPhase("idle");
        setCountdown(null);
        setCursorIndex(0);
        setWrongChars(new Set());
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

            const { nextIndex: currentIndex, advanced: autoAdvanced } = autoAdvanceIndentationIfAllowed(cursorIndexRef.current);

            // If auto-advance happened, we need to account for it
            // But wait, the original logic applied updates inside the helper.
            // Let's replicate the logic:

            // If we auto-advanced, we update state and return
            if (autoAdvanced > 0) {
                setCursorIndex(currentIndex);
                setTotalTypedChars(prev => prev + autoAdvanced);
                // Auto-advance counts as correct keystrokes? 
                // It's "free" characters. They shouldn't count as keystrokes, but they count as "correct chars" for progress.
                // But for "Correct Keystrokes" metric, they are NOT keystrokes.

                setWrongChars(prev => {
                    if (prev.size === 0) return prev;
                    const next = new Set(prev);
                    for (let offset = cursorIndexRef.current; offset < currentIndex; offset++) {
                        next.delete(offset);
                    }
                    return next;
                });
                // The original logic returned here?
                // "return { advanced, nextIndex: target }"
                // And then:
                // "setCursorIndex(target); ... return { advanced, nextIndex: target };"
                // Wait, the original logic had side effects inside `autoAdvanceIndentationIfAllowed`.
                // I should probably just inline it or keep it as a helper that returns what to do.
            }

            const content = snippetRef.current.content;
            if (currentIndex >= content.length) return;

            // Manual tab handling (if not auto-advanced or if we are at indentation point)
            // The original logic:
            // 1. Call autoAdvanceIndentationIfAllowed. If it advanced, it updated state.
            // 2. Then it checked for manual tab indentation (spaces)

            // Let's simplify. We'll just use the current cursorIndex from state in the next render cycle?
            // No, we need atomic updates.

            // Re-implementing the logic cleanly:

            let effectiveIndex = cursorIndexRef.current;
            let effectiveTyped = 0; // delta

            // 1. Auto-advance check
            const auto = autoAdvanceIndentationIfAllowed(effectiveIndex);
            if (auto.advanced > 0) {
                effectiveIndex = auto.nextIndex;
                effectiveTyped += auto.advanced;

                // Apply updates for auto-advance
                setCursorIndex(effectiveIndex);
                setTotalTypedChars(prev => prev + auto.advanced);
                setWrongChars(prev => {
                    if (prev.size === 0) return prev;
                    const next = new Set(prev);
                    for (let i = cursorIndexRef.current; i < effectiveIndex; i++) next.delete(i);
                    return next;
                });

                // Original code returned here if advanced > 0
                return;
            }

            // 2. Manual Tab (spaces)
            // content is already defined above
            let advanced = 0;
            while (
                advanced < INDENT_WIDTH &&
                effectiveIndex + advanced < content.length &&
                content[effectiveIndex + advanced] === " "
            ) {
                advanced += 1;
            }

            if (advanced > 0) {
                setCursorIndex(i => i + advanced);
                setTotalTypedChars(prev => prev + advanced);
                // Manual tab is a correct action
                setCorrectKeystrokes(prev => prev + 1);
                setWrongChars(prev => {
                    if (prev.size === 0) return prev;
                    const next = new Set(prev);
                    for (let i = 0; i < advanced; i++) next.delete(effectiveIndex + i);
                    return next;
                });
                return;
            }

            // 3. Manual Tab (literal tab character)
            const expected = snippetRef.current.content[effectiveIndex];
            if (expected === "\t") {
                setCursorIndex(i => i + 1);
                setTotalTypedChars(prev => prev + 1);
                setCorrectKeystrokes(prev => prev + 1);
                setWrongChars(prev => {
                    if (!prev.has(effectiveIndex)) return prev;
                    const next = new Set(prev);
                    next.delete(effectiveIndex);
                    return next;
                });
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
            setCursorIndex(i => Math.max(0, i - 1));
            setWrongChars(prev => {
                const next = new Set(prev);
                next.delete(targetIndex);
                return next;
            });
            return;
        }

        // Regular typing
        const { nextIndex: currentIndex, advanced } = autoAdvanceIndentationIfAllowed(cursorIndexRef.current);

        // If auto-advance happened
        if (advanced > 0) {
            setCursorIndex(currentIndex);
            setTotalTypedChars(prev => prev + advanced);
            setWrongChars(prev => {
                if (prev.size === 0) return prev;
                const next = new Set(prev);
                for (let i = cursorIndexRef.current; i < currentIndex; i++) next.delete(i);
                return next;
            });
            // We continue to process the key press at the NEW index?
            // Original code: "const { nextIndex: currentIndex } = autoAdvanceIndentationIfAllowed(cursorIndex);"
            // It DID NOT return early. It used the new index as the target for the typed character.
            // But wait, `autoAdvanceIndentationIfAllowed` in original code had side effects:
            // "setCursorIndex(target); ... return { advanced, nextIndex: target };"
            // And then: "const { nextIndex: currentIndex } = autoAdvanceIndentationIfAllowed(cursorIndex);"
            // If it advanced, it updated state.
            // Then it continued: "const expected = snippet.content[currentIndex];"
            // So yes, it advances past whitespace, THEN checks the key against the character AFTER the whitespace.
        }

        const expected = snippetRef.current.content[currentIndex];
        if (expected === undefined) return;

        swallowEvent();

        const got = e.key === "Enter" ? "\n" : e.key;
        const ok = normalizeWhitespace(got) === normalizeWhitespace(expected);

        setCursorIndex(i => i + 1);
        setTotalTypedChars(prev => prev + 1);

        if (ok) {
            setCorrectKeystrokes(prev => prev + 1);
            setWrongChars(prev => {
                if (!prev.has(currentIndex)) return prev;
                const next = new Set(prev);
                next.delete(currentIndex);
                return next;
            });

            // Check for completion immediately after a correct keystroke
            // We use currentIndex + 1 because we just advanced the cursor
            const nextIdx = currentIndex + 1;
            const snippetContent = snippetRef.current.content;
            const isEnd = nextIdx >= snippetContent.length;
            const isTrailingNewline = nextIdx === snippetContent.length - 1 && snippetContent[nextIdx] === "\n";

            if (isEnd || isTrailingNewline) {
                setPhase("finished");
                if (onFinish) onFinish();
            }
        } else {
            setWrongChars(prev => new Set(prev).add(currentIndex));
            setLastErrorAt(timestamp);
            setNow(timestamp);
            setErrorLog(prev => {
                const next = [...prev, { expected, got, index: currentIndex }];
                if (next.length > 200) next.shift();
                return next;
            });
        }

    }, [autoAdvanceIndentationIfAllowed, onFinish, preferences.vimMode]);

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
        startTime: null as number | null,
        totalTypedChars: 0,
        totalKeystrokes: 0,
        correctKeystrokes: 0,
    });

    // Keep ref in sync (doesn't trigger re-renders)
    useEffect(() => {
        metricsInputRef.current = {
            cursorIndex,
            wrongChars,
            snippetContent: snippet.content,
            startTime,
            totalTypedChars,
            totalKeystrokes,
            correctKeystrokes,
        };
    }, [cursorIndex, wrongChars, snippet.content, startTime, totalTypedChars, totalKeystrokes, correctKeystrokes]);

    // Helper to calculate and publish metrics (only when called)
    const calculateAndPublishMetrics = useCallback(() => {
        const { cursorIndex: idx, wrongChars: errs, snippetContent, startTime: start, totalTypedChars: typed, totalKeystrokes: strokes, correctKeystrokes: correct } = metricsInputRef.current;

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
                        if (errs.has(j)) {
                            isPerfect = false;
                            break;
                        }
                    }
                    if (isPerfect && i > wordStart) {
                        perfectChars += (i - wordStart);
                        if (i < idx && !errs.has(i)) {
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

    const caretErrorActive = lastErrorAt !== null && now >= lastErrorAt && now - lastErrorAt < 600;

    return {
        phase,
        countdown,
        cursorIndex,
        wrongChars,
        metrics: publishedMetrics,
        elapsedMs,
        errorLog,
        caretErrorActive,
        history,
        reset,
        start,
        handleKeyDown,
        setPhase, // Exposed for edge cases like "Escape" handled outside or "R"
    };
}
