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

    // Timer tick
    useEffect(() => {
        if (phase !== "running") return;
        const id = setInterval(() => setNow(Date.now()), 100);
        return () => clearInterval(id);
    }, [phase]);

    // Countdown logic
    useEffect(() => {
        if (phase !== "countdown") return;
        
        // If reduced motion is on, skip countdown (handled in start handler usually, but good safety)
        // We'll assume the caller handles the initial check, but here we manage the tick.
        
        if (countdown === null) {
            setCountdown(3);
            return;
        }

        if (countdown === 0) {
            const id = window.setTimeout(() => {
                setCountdown(null);
                setPhase("running");
                setStartTime(Date.now());
                setNow(Date.now());
            }, 400);
            return () => window.clearTimeout(id);
        }

        const delay = countdown === 3 ? 600 : 1000;
        const id = window.setTimeout(() => {
            setCountdown((prev) => (prev ?? 1) - 1);
        }, delay);
        return () => window.clearTimeout(id);
    }, [phase, countdown]);

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
    }, []);

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

    }, [cursorIndex, phase, snippet.content, autoAdvanceIndentationIfAllowed]);

    // Check for finish
    useEffect(() => {
        if (phase === "running" && cursorIndex >= snippet.content.length) {
            setPhase("finished");
            if (onFinish) onFinish();
        }
    }, [cursorIndex, phase, snippet.content.length, onFinish]);

    const elapsedMs = startTime ? now - startTime : 0;
    const outstandingErrors = wrongChars.size;
    const correct = Math.max(0, cursorIndex - outstandingErrors);
    const metrics = computeMetrics({
        correctProgress: correct,
        elapsedMs,
        totalTyped: totalTypedChars,
        errors: outstandingErrors,
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
        reset,
        start,
        handleKeyDown,
        setPhase, // Exposed for edge cases like "Escape" handled outside or "R"
    };
}

