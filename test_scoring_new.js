const { computeMetrics } = require("./lib/scoring");

// Mock the types since we are in JS
// type ComputeMetricsInput = {
//     correctProgress: number; // Characters in perfect words
//     elapsedMs: number;
//     totalTyped: number; // Total characters currently in the buffer
//     totalKeystrokes?: number; // Total keys pressed
//     correctKeystrokes?: number; // Total correct keys pressed
// };

function test(name, input, expected) {
    const result = computeMetrics(input);
    const passed =
        Math.abs(result.rawWpm - expected.rawWpm) < 0.1 &&
        Math.abs(result.adjustedWpm - expected.adjustedWpm) < 0.1 &&
        Math.abs(result.accuracy - expected.accuracy) < 0.001;

    if (passed) {
        console.log(`[PASS] ${name}`);
    } else {
        console.error(`[FAIL] ${name}`);
        console.error("Expected:", expected);
        console.error("Actual:", result);
    }
}

console.log("Running Scoring Tests...");

// Scenario 1: Perfect typing
// 60 chars typed, 60 correct keystrokes, 1 minute.
// Raw WPM: (60/5)/1 = 12
// Net WPM: (60/5)/1 = 12
// Accuracy: 60/60 = 1.0
test("Perfect Typing (1 min)", {
    correctProgress: 60,
    elapsedMs: 60000,
    totalTyped: 60,
    totalKeystrokes: 60,
    correctKeystrokes: 60
}, {
    rawWpm: 12,
    adjustedWpm: 12,
    accuracy: 1.0
});

// Scenario 2: Mistakes made and corrected
// Typed "hullo" (5 chars), backspaced 5 times, typed "hello" (5 chars).
// Total keystrokes: 5 (wrong) + 5 (backspace) + 5 (right) = 15? 
// Wait, backspace counts as keystroke.
// Correct keystrokes: 5 (the final "hello").
// Perfect word chars: 5 ("hello").
// Time: 1 minute.
// Raw WPM: (15/5)/1 = 3
// Net WPM: (5/5)/1 = 1
// Accuracy: 5/15 = 0.333...
test("Mistakes Corrected", {
    correctProgress: 5,
    elapsedMs: 60000,
    totalTyped: 5,
    totalKeystrokes: 15,
    correctKeystrokes: 5
}, {
    rawWpm: 3,
    adjustedWpm: 1,
    accuracy: 1 / 3
});

// Scenario 3: Uncorrected mistake
// Typed "hullo" (5 chars). Left it.
// Total keystrokes: 5.
// Correct keystrokes: 0 (assuming strict checking, or maybe 4 if 'h','l','l','o' matched? But engine usually counts correct key presses).
// If I typed 'h' (ok), 'u' (wrong), 'l' (ok), 'l' (ok), 'o' (ok).
// Correct keystrokes: 4.
// Total keystrokes: 5.
// Perfect word chars: 0 (word is wrong).
// Time: 1 min.
// Raw WPM: (5/5)/1 = 1
// Net WPM: 0
// Accuracy: 4/5 = 0.8
test("Uncorrected Mistake", {
    correctProgress: 0,
    elapsedMs: 60000,
    totalTyped: 5,
    totalKeystrokes: 5,
    correctKeystrokes: 4
}, {
    rawWpm: 1,
    adjustedWpm: 0,
    accuracy: 0.8
});

// Scenario 4: Fast typing
// 300 chars, 300 keystrokes, 0.5 min (30s).
// Raw: (300/5)/0.5 = 60 / 0.5 = 120
// Net: 120
// Accuracy: 1.0
test("Fast Typing", {
    correctProgress: 300,
    elapsedMs: 30000,
    totalTyped: 300,
    totalKeystrokes: 300,
    correctKeystrokes: 300
}, {
    rawWpm: 120,
    adjustedWpm: 120,
    accuracy: 1.0
});

// Scenario 5: Legacy Fallback (no keystroke data)
// 60 chars typed, 60 correct progress, 1 min.
// Should behave like old logic.
// Raw: (60/5)/1 = 12
// Net: 12
// Accuracy: 1.0 (default fallback logic might differ, let's check)
// Logic: !totalKeystrokes ? 1 : ...
test("Legacy Fallback", {
    correctProgress: 60,
    elapsedMs: 60000,
    totalTyped: 60
}, {
    rawWpm: 12,
    adjustedWpm: 12,
    accuracy: 1.0
});
