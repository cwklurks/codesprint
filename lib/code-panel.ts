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

/**
 * Decide whether the caret should fire its positive "thump" feedback.
 *
 * Fires only when the cursor advanced FORWARD and the character just consumed
 * (the one immediately before the new position) was typed correctly. Backspaces,
 * no-ops, and advances that landed on a flagged-wrong char get no reward.
 */
export function shouldThumpCaret(
    prevCursorChar: number,
    nextCursorChar: number,
    wrongChars: Set<number>,
): boolean {
    if (nextCursorChar <= prevCursorChar) {
        return false;
    }
    const consumedIndex = nextCursorChar - 1;
    return !wrongChars.has(consumedIndex);
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
