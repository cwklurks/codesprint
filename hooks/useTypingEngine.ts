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

    useEffect(() => {
        phaseRef.current = phase;
    }, [phase]);

    useEffect(() => {
        startTimeRef.current = startTime;
    }, [startTime]);

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

            if (phaseNow === "idle" || phaseNow === "countdown") {
                setPhase("running");
                setCountdown(null);
                if (!startTimeRef.current) {
                    const ts = Date.now();
                    setStartTime(ts);
                    setNow(ts);
                }
            }

            // Tab counts as a keystroke? Usually yes.
            setTotalKeystrokes(prev => prev + 1);

            const { nextIndex: currentIndex, advanced: autoAdvanced } = autoAdvanceIndentationIfAllowed(cursorIndex);

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
            const expected = content[effectiveIndex];
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

        if (phaseNow === "idle" || phaseNow === "countdown") {
            setPhase("running");
            setCountdown(null);
            if (!startTimeRef.current) {
                setStartTime(timestamp);
                setNow(timestamp);
            }
        }

        // Count every actionable key press as a keystroke
        setTotalKeystrokes(prev => prev + 1);

        if (e.key === "Backspace") {
            if (phaseNow === "finished") {
                setPhase("running");
            }
            swallowEvent();
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

    }, [cursorIndex, phase, snippet.content, autoAdvanceIndentationIfAllowed, onFinish, preferences.vimMode]);

    // Calculate Perfect Words for Adjusted WPM
    // A word is perfect if all its characters are typed and there are no errors in its range.
    // AND it is fully behind the cursor.
    const getPerfectWordChars = useCallback(() => {
        const content = snippet.content;
        let perfectChars = 0;
        let wordStart = 0;

        // Simple word boundary detection (space or newline)
        // We iterate through content up to cursorIndex
        for (let i = 0; i <= cursorIndex; i++) {
            const char = content[i];
            const isWordEnd = i === content.length || char === " " || char === "\n" || char === "\t";

            if (isWordEnd) {
                // Check if this word [wordStart, i) is fully typed and perfect
                if (i <= cursorIndex) {
                    let isPerfect = true;
                    // Check for errors in this range
                    for (let j = wordStart; j < i; j++) {
                        if (wrongChars.has(j)) {
                            isPerfect = false;
                            break;
                        }
                    }

                    // Also, strictly speaking, if we passed it, and wrongChars doesn't have it, it's correct.
                    // But we only count it if we have *completed* the word.
                    // i <= cursorIndex means we have reached the end of the word.

                    if (isPerfect && i > wordStart) {
                        perfectChars += (i - wordStart);
                        // Add 1 for the space/separator if we typed it correctly?
                        // User said: "Total Correct Characters typically includes the space after a correct word."
                        // If we are past the space (i < cursorIndex), we typed the space.
                        // Was the space correct?
                        if (i < cursorIndex && !wrongChars.has(i)) {
                            perfectChars += 1;
                        }
                    }
                }
                wordStart = i + 1;
            }
        }
        return perfectChars;
    }, [cursorIndex, wrongChars, snippet.content]);

    const elapsedMs = startTime ? now - startTime : 0;
    // Use the new perfect word calculation
    const perfectChars = getPerfectWordChars();

    const currentMetrics = computeMetrics({
        correctProgress: perfectChars,
        elapsedMs,
        totalTyped: totalTypedChars,
        totalKeystrokes,
        correctKeystrokes
    });

    const [publishedMetrics, setPublishedMetrics] = useState(currentMetrics);
    const lastPublishedRef = useRef(0);

    useEffect(() => {
        const nowTs = Date.now();
        // Update if:
        // 1. Phase is finished (ensure final stats are accurate)
        // 2. Phase is idle (reset)
        // 3. 1.5 seconds have passed since last update
        const shouldUpdate =
            phase === "finished" ||
            phase === "idle" ||
            nowTs - lastPublishedRef.current >= 1500;

        if (shouldUpdate) {
            setPublishedMetrics(currentMetrics);
            lastPublishedRef.current = nowTs;
        }
    }, [currentMetrics, phase]);

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
