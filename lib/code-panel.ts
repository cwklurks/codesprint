export function normalizeHexColor(color: string): string {
    if (!color.startsWith("#")) {
        return color;
    }

    const hex = color.slice(1);
    if (hex.length === 3 || hex.length === 4) {
        return `#${hex.split("").map((char) => char + char).join("")}`;
    }

    return color;
}

export function hexToRgb(color: string): [number, number, number] {
    const normalized = normalizeHexColor(color);
    const sanitized = normalized.replace("#", "");

    if (sanitized.length !== 6 && sanitized.length !== 8) {
        return [0, 0, 0];
    }

    const numeric = parseInt(sanitized.slice(0, 6), 16);
    if (Number.isNaN(numeric)) {
        return [0, 0, 0];
    }

    return [
        (numeric >> 16) & 255,
        (numeric >> 8) & 255,
        numeric & 255,
    ];
}

export function toMonacoColor(color: string): string {
    if (color.startsWith("#")) {
        return normalizeHexColor(color);
    }

    if (color.startsWith("rgba") || color.startsWith("rgb")) {
        const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (!match) {
            return color;
        }

        const [, r, g, b, alpha] = match;
        const alphaHex =
            alpha == null
                ? ""
                : Math.round(Math.min(1, Math.max(0, parseFloat(alpha))) * 255)
                    .toString(16)
                    .padStart(2, "0");

        return `#${Number(r).toString(16).padStart(2, "0")}${Number(g).toString(16).padStart(2, "0")}${Number(b).toString(16).padStart(2, "0")}${alphaHex}`;
    }

    return color;
}

export function withMonacoAlpha(color: string, alpha: number): string {
    const normalized = toMonacoColor(color);
    if (!normalized.startsWith("#")) {
        return normalized;
    }

    const hex = normalized.slice(1);
    const alphaHex = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
        .toString(16)
        .padStart(2, "0");

    if (hex.length === 6) {
        return `#${hex}${alphaHex}`;
    }

    if (hex.length === 8) {
        return `#${hex.slice(0, 6)}${alphaHex}`;
    }

    return normalized;
}

import { HEIGHT_BUFFER_LINES, LINE_HEIGHT_MULTIPLIER, MIN_EDITOR_HEIGHT } from "./constants";

/**
 * Estimate the editor's rendered height for a snippet so callers can reserve the
 * matching layout space ahead of the dynamic CodePanel mount (no mount-time jump).
 *
 * There is intentionally NO maximum cap: the editor renders at full content height
 * so Monaco never scrolls internally. The page (useAutoScroll) is then the single
 * smooth scroll authority that follows the caret, matching Monkeytype's line-follow.
 */
export function estimateEditorHeight(content: string, fontSize: number): number {
    const lineHeight = Math.round(fontSize * LINE_HEIGHT_MULTIPLIER);
    const lines = content.split("\n").length + HEIGHT_BUFFER_LINES;
    return Math.max(MIN_EDITOR_HEIGHT, lines * lineHeight);
}

/** Half-open completed ranges, split only at errors. Errors must be sorted ascending. */
export function getCompletedRanges(caretIndex: number, sortedWrongChars: readonly number[]): [number, number][] {
    const ranges: [number, number][] = [];
    let start = 0;
    for (const error of sortedWrongChars) {
        if (error >= caretIndex) break;
        if (error > start) ranges.push([start, error]);
        start = error + 1;
    }
    if (start < caretIndex) ranges.push([start, caretIndex]);
    return ranges;
}

export function getPreviewIndex(content: string, caretIndex: number, previewChars = 12): number {
    let index = Math.max(0, Math.min(caretIndex, content.length));
    let remaining = Math.max(0, previewChars);

    while (index < content.length && remaining > 0) {
        const char = content[index];
        if (char === "\n" || char === "\r") {
            break;
        }

        index += 1;
        remaining -= 1;
    }

    return index;
}
