/**
 * Core application constants extracted from magic numbers across the codebase.
 * This file centralizes timing values, thresholds, and numeric parameters.
 */

// =============================================================================
// Editor / UI Constants
// =============================================================================

/** Line height multiplier for editor line height calculation */
export const LINE_HEIGHT_MULTIPLIER = 1.55;

/** Buffer lines added to editor height calculation */
export const HEIGHT_BUFFER_LINES = 4;

/** Maximum editor height in pixels */
export const MAX_EDITOR_HEIGHT = 720;

/** Minimum editor height in pixels */
export const MIN_EDITOR_HEIGHT = 320;

/** Caret blink timeout duration in milliseconds */
export const CARET_BLINK_TIMEOUT_MS = 650;

// =============================================================================
// Scoring Constants
// =============================================================================

/** Standard word length for WPM calculations (characters per word) */
export const WORD_LENGTH_CHARS = 5;

/** Milliseconds per minute for WPM conversion */
export const MS_PER_MINUTE = 60000;

/** Minimum accuracy threshold for "good" performance (0-1 scale) */
export const GOOD_ACCURACY_THRESHOLD = 0.9;

/** Accuracy threshold below which WPM is penalized */
export const WPM_PENALTY_ACCURACY_THRESHOLD = 0.85;

// =============================================================================
// Timing / Debounce Constants
// =============================================================================

/** Default debounce delay in milliseconds */
export const DEBOUNCE_DELAY_MS = 300;

/** Minimum typing session duration to be considered valid (ms) */
export const MIN_SESSION_DURATION_MS = 1000;

/** Maximum time between keystrokes before session is considered idle (ms) */
export const IDLE_TIMEOUT_MS = 30000;

// =============================================================================
// Session / Run Constants
// =============================================================================

/** Maximum historical sessions to keep for analytics */
export const MAX_STORED_SESSIONS = 1000;

/** Default countdown duration in seconds */
export const DEFAULT_COUNTDOWN_SECONDS = 3;

/** Minimum snippet length in characters to be considered valid */
export const MIN_SNIPPET_LENGTH = 10;

// =============================================================================
// Rate Limiting Constants
// =============================================================================

/** Cooldown between AI drill requests in milliseconds */
export const AI_DRILL_COOLDOWN_MS = 5000;

/** Maximum AI drill requests per minute */
export const AI_DRILL_MAX_PER_MINUTE = 10;

/** Maximum AI drill requests per day */
export const AI_DRILL_MAX_PER_DAY = 50;
