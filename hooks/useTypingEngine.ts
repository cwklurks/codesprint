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

    const phaseRef = useRef(phase);
    const startTimeRef = useRef(startTime);

    useEffect(() => {
        phaseRef.current = phase;
    }, [phase]);

    useEffect(() => {
        startTimeRef.current = startTime;
    }, [startTime]);

    // History tracking
    const [history, setHistory] = useState<Array<{ time: number; wpm: number; raw: number; errors: number }>>([]);

    // Timer tick & History update
    useEffect(() => {
        if (phase !== "running") return;

        const id = setInterval(() => {
            const nowTs = Date.now();
            setNow(nowTs);

            // Update history every 1s (approx)
            if (startTimeRef.current) {
                const currentElapsed = nowTs - startTimeRef.current;
                // Only add history point if we have at least 1 second of data and it's roughly on a second boundary
                // Actually, let's just push every second.
                // We can use a separate interval or just check time.
                // Let's keep it simple: push to history if enough time passed since last push?
                // Better: just calculate metrics here and push.
            }
        }, 100);

        const historyId = setInterval(() => {
            if (!startTimeRef.current) return;
            const nowTs = Date.now();
            const currentElapsed = nowTs - startTimeRef.current;

            // Don't record if very start
            if (currentElapsed < 1000) return;

            setHistory(prev => {
                // Avoid duplicates if multiple intervals fire (unlikely with 1s but good safety)
                const last = prev[prev.length - 1];
                const timeSeconds = Math.floor(currentElapsed / 1000);
                if (last && last.time === timeSeconds) return prev;

                // Calculate instantaneous metrics
                // Note: This is "cumulative" metrics at this point in time, which is standard for these graphs
                // For "instantaneous" we'd need a sliding window, but cumulative is smoother and easier.
                // Monkeytype uses "raw" (all chars) and "wpm" (correct chars) over time.

                // We need access to current state. 
                // `totalTypedChars` and `wrongChars` and `cursorIndex` are from closure.
                // They might be stale in this interval if not careful.
                // Actually, `setInterval` closure will trap initial values if we don't use refs or dependency array.
                // But adding them to dependency array restarts interval.
                // Best way: use functional state update or refs.
                // Let's use refs for the stats we need.
                return prev;
            });
        }, 1000);

        return () => {
            clearInterval(id);
            clearInterval(historyId);
        };
    }, [phase]);

    // We need refs for history tracking to avoid restarting interval
    const statsRef = useRef({ cursorIndex: 0, totalTypedChars: 0, wrongCharsSize: 0 });
    useEffect(() => {
        statsRef.current = { cursorIndex, totalTypedChars, wrongCharsSize: wrongChars.size };
    }, [cursorIndex, totalTypedChars, wrongChars]);

    // Separate effect for history to avoid complex dependencies
    useEffect(() => {
        if (phase !== "running") return;

        const historyId = setInterval(() => {
            const start = startTimeRef.current;
            if (!start) return;

            const nowTs = Date.now();
            const elapsed = nowTs - start;
            if (elapsed < 1000) return;

            const { cursorIndex, totalTypedChars, wrongCharsSize } = statsRef.current;

            const minutes = elapsed / 60000;
            const rawWpm = Math.round((totalTypedChars / 5) / minutes);
            const netWpm = Math.max(0, Math.round(((cursorIndex - wrongCharsSize) / 5) / minutes));

            setHistory(prev => {
                const timePoint = Math.floor(elapsed / 1000);
                // Avoid duplicate seconds
                if (prev.length > 0 && prev[prev.length - 1].time === timePoint) return prev;

                return [...prev, {
                    time: timePoint,
                    wpm: netWpm,
                    raw: rawWpm,
                    errors: wrongCharsSize
                }];
            });
        }, 1000);

        return () => clearInterval(historyId);
    }, [phase]);

    const reset = useCallback(() => {
        setPhase("idle");
        setCountdown(null);
        setCursorIndex(0);
        setWrongChars(new Set());
        setStartTime(null);
        setNow(Date.now());
        setLastErrorAt(null);
        setErrorLog([]);
        setTotalTypedChars(0);
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

    // Auto-advance indentation logic
    const autoAdvanceIndentationIfAllowed = useCallback((index: number): { advanced: number; nextIndex: number } => {
        const content = snippet.content;
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
    }, [snippet.content, preferences.requireTabForIndent]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        const phaseNow = phaseRef.current;

        // Ignore modifiers
        if (e.key === "Meta" || e.key === "Alt" || e.key === "Control") return;

        // Handle Tab
        if (e.key === "Tab") {
            e.preventDefault();
            e.stopPropagation();

            if (phaseNow === "finished") return;

            if (phaseNow === "idle" || phaseNow === "countdown") {
                setPhase("running");
                setCountdown(null);
                if (!startTimeRef.current) {
                    const ts = Date.now();
                    setStartTime(ts);
                    setNow(ts);
                }
            }

            const { nextIndex: currentIndex, advanced: autoAdvanced } = autoAdvanceIndentationIfAllowed(cursorIndex);

            // If auto-advance happened, we need to account for it
            // But wait, the original logic applied updates inside the helper.
            // Let's replicate the logic:

            // If we auto-advanced, we update state and return
            if (autoAdvanced > 0) {
                setCursorIndex(currentIndex);
                setTotalTypedChars(prev => prev + autoAdvanced);
                setWrongChars(prev => {
                    if (prev.size === 0) return prev;
                    const next = new Set(prev);
                    for (let offset = cursorIndex; offset < currentIndex; offset++) {
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

            const content = snippet.content;
            if (currentIndex >= content.length) return;

            // Manual tab handling (if not auto-advanced or if we are at indentation point)
            // The original logic:
            // 1. Call autoAdvanceIndentationIfAllowed. If it advanced, it updated state.
            // 2. Then it checked for manual tab indentation (spaces)

            // Let's simplify. We'll just use the current cursorIndex from state in the next render cycle?
            // No, we need atomic updates.

            // Re-implementing the logic cleanly:

            let effectiveIndex = cursorIndex;
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
                    for (let i = cursorIndex; i < effectiveIndex; i++) next.delete(i);
                    return next;
                });

                // Original code returned here if advanced > 0
                return;
            }

            // 2. Manual Tab (spaces)
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
                setWrongChars(prev => {
                    if (prev.size === 0) return prev;
                    const next = new Set(prev);
                    for (let i = 0; i < advanced; i++) next.delete(effectiveIndex + i);
                    return next;
                });
                return;
            }

            // 3. Manual Tab (literal tab character)
            const expected = content[effectiveIndex];
            if (expected === "\t") {
                setCursorIndex(i => i + 1);
                setTotalTypedChars(prev => prev + 1);
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
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        if (phaseNow === "idle" || phaseNow === "countdown") {
            setPhase("running");
            setCountdown(null);
            if (!startTimeRef.current) {
                setStartTime(timestamp);
                setNow(timestamp);
            }
        }

        if (e.key === "Backspace") {
            if (phaseNow === "finished") {
                setPhase("running");
            }
            e.preventDefault();
            e.stopPropagation();
            if (cursorIndex === 0) return;

            const targetIndex = cursorIndex - 1;
            setCursorIndex(i => Math.max(0, i - 1));
            setWrongChars(prev => {
                const next = new Set(prev);
                next.delete(targetIndex);
                return next;
            });
            return;
        }

        // Regular typing
        const { nextIndex: currentIndex, advanced } = autoAdvanceIndentationIfAllowed(cursorIndex);

        // If auto-advance happened
        if (advanced > 0) {
            setCursorIndex(currentIndex);
            setTotalTypedChars(prev => prev + advanced);
            setWrongChars(prev => {
                if (prev.size === 0) return prev;
                const next = new Set(prev);
                for (let i = cursorIndex; i < currentIndex; i++) next.delete(i);
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

        const expected = snippet.content[currentIndex];
        if (expected === undefined) return;

        e.preventDefault();
        e.stopPropagation();

        const got = e.key === "Enter" ? "\n" : e.key;
        const ok = normalizeWhitespace(got) === normalizeWhitespace(expected);

        setCursorIndex(i => i + 1);
        setTotalTypedChars(prev => prev + 1);

        if (ok) {
            setWrongChars(prev => {
                if (!prev.has(currentIndex)) return prev;
                const next = new Set(prev);
                next.delete(currentIndex);
                return next;
            });

            // Check for completion immediately after a correct keystroke
            // We use currentIndex + 1 because we just advanced the cursor
            const nextIdx = currentIndex + 1;
            const isEnd = nextIdx >= snippet.content.length;
            const isTrailingNewline = nextIdx === snippet.content.length - 1 && snippet.content[nextIdx] === "\n";

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

    }, [cursorIndex, phase, snippet.content, autoAdvanceIndentationIfAllowed, onFinish]);

    // Check for finish (removed useEffect-based check to prevent race conditions and ensure immediate finish)
    // The check is now performed directly in the keydown handler for immediate feedback.

    const elapsedMs = startTime ? now - startTime : 0;
    const outstandingErrors = wrongChars.size;
    const correct = Math.max(0, cursorIndex - outstandingErrors);
    const metrics = computeMetrics({
        correctProgress: correct,
        elapsedMs,
        totalTyped: totalTypedChars,
    });

    const caretErrorActive = lastErrorAt !== null && now >= lastErrorAt && now - lastErrorAt < 600;

    return {
        phase,
        countdown,
        cursorIndex,
        wrongChars,
        metrics,
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
