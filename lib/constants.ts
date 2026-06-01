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

/** Caret "thump" feedback duration in milliseconds. Must stay under 120ms so it
 *  never throttles fast typists; matches the cs-caret-thump keyframe length. */
export const CARET_THUMP_TIMEOUT_MS = 90;

// =============================================================================
// Scoring Constants
// =============================================================================

/** Standard word length for WPM calculations (characters per word) */
export const WORD_LENGTH_CHARS = 5;

/** Milliseconds per minute for WPM conversion */
export const MS_PER_MINUTE = 60000;
