/**
 * Canvas-based shareable result card generator.
 *
 * Renders a PNG image with the user's session results using theme colors.
 * Designed for sharing on social media, Discord, etc.
 */

import { computePercentile } from "./percentile";
import { bestDelta } from "./personal-best";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ShareCardData = {
    /** Adjusted WPM score */
    wpm: number;
    /** Raw WPM based on total keystrokes */
    rawWpm: number;
    accuracy: number;
    patternScore?: number;
    snippetTitle: string;
    language: string;
    difficulty: string;
    timeMs: number;
    /** WPM history for sparkline */
    history: { time: number; wpm: number }[];
    /** Best WPM across all prior runs, excluding the current run (optional, back-compatible) */
    bestWpm?: number;
    /** Whether this run set a new personal best (optional, back-compatible) */
    isNewBest?: boolean;
};

type ThemeColors = {
    bg: string;
    text: string;
    textSubtle: string;
    accent: string;
    surface: string;
    border: string;
};

type Elevation = { offsetY: number; blur: number; color: string } | null;

type CardMetrics = {
    /** Resolved font stack for canvas `ctx.font`, mono when the webfont loaded. */
    font: string;
    /** Corner radius for the card itself, from --radius-xl. */
    radius: number;
    /** Corner radius for the inner graph panel, from --radius-md. */
    innerRadius: number;
    /** The theme's --elev-2, translated to canvas shadow terms (null if absent). */
    elevation: Elevation;
};

// ---------------------------------------------------------------------------
// Theme color extraction
// ---------------------------------------------------------------------------

function getThemeColors(): ThemeColors {
    if (typeof window === "undefined") {
        return {
            bg: "#0f0f0f",
            text: "#e0e0e0",
            textSubtle: "#888888",
            accent: "#f5c542",
            surface: "#1a1a1a",
            border: "#333333",
        };
    }

    const styles = getComputedStyle(document.documentElement);
    return {
        bg: styles.getPropertyValue("--bg").trim() || "#0f0f0f",
        text: styles.getPropertyValue("--text").trim() || "#e0e0e0",
        textSubtle: styles.getPropertyValue("--text-subtle").trim() || "#888888",
        accent: styles.getPropertyValue("--accent").trim() || "#f5c542",
        surface: styles.getPropertyValue("--surface").trim() || "#1a1a1a",
        border: styles.getPropertyValue("--border").trim() || "#333333",
    };
}

// ---------------------------------------------------------------------------
// Typography and geometry
// ---------------------------------------------------------------------------

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 800;
const PADDING = 48;
const FALLBACK_FONT = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
/** Weights the card actually draws with; all must be ready before the first fillText. */
const CARD_FONT_WEIGHTS = [400, 700];

function cssNumber(styles: CSSStyleDeclaration, name: string, fallback: number): number {
    const parsed = Number.parseFloat(styles.getPropertyValue(name));
    return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Themes emit elevation as `0 <offsetY>px <blur>px <color>` (lib/preferences-core.ts).
 * Canvas has no box-shadow, so translate that one shape and skip the shadow
 * entirely if a theme ever writes something else.
 */
function parseElevation(styles: CSSStyleDeclaration, name: string): Elevation {
    const match = styles.getPropertyValue(name).trim().match(/^0\s+(-?[\d.]+)px\s+([\d.]+)px\s+(.+)$/);
    if (!match) return null;
    return { offsetY: Number.parseFloat(match[1]), blur: Number.parseFloat(match[2]), color: match[3] };
}

/**
 * Canvas does not wait for webfonts, so an unprepared `ctx.font` silently falls
 * back to a system face and the card stops looking like the app. Resolve the
 * app's own --font-mono stack (next/font rewrites the family name, so it has to
 * be read from the document rather than hardcoded), preload every weight we
 * draw, and only claim the stack once document.fonts confirms it.
 */
async function resolveCardMetrics(): Promise<CardMetrics> {
    if (typeof document === "undefined") {
        return { font: FALLBACK_FONT, radius: 20, innerRadius: 12, elevation: null };
    }

    const styles = getComputedStyle(document.documentElement);
    const geometry = {
        radius: cssNumber(styles, "--radius-xl", 20),
        innerRadius: cssNumber(styles, "--radius-md", 12),
        elevation: parseElevation(styles, "--elev-2"),
    };
    const stack = styles.getPropertyValue("--font-mono").trim();
    const primary = stack.split(",")[0]?.trim();

    if (!stack || !primary || !document.fonts) {
        return { font: stack || FALLBACK_FONT, ...geometry };
    }

    try {
        await Promise.all(
            CARD_FONT_WEIGHTS.map((weight) => document.fonts.load(`${weight} 16px ${primary}`)),
        );
        const ready = CARD_FONT_WEIGHTS.every((weight) =>
            document.fonts.check(`${weight} 16px ${primary}`),
        );
        return { font: ready ? stack : FALLBACK_FONT, ...geometry };
    } catch {
        return { font: FALLBACK_FONT, ...geometry };
    }
}

// ---------------------------------------------------------------------------
// Canvas rendering
// ---------------------------------------------------------------------------

export async function renderShareCard(data: ShareCardData): Promise<HTMLCanvasElement> {
    const canvas = document.createElement("canvas");
    // Render at device pixel ratio (capped at 2x) so the card is crisp on retina
    // and in social embeds; all drawing stays in logical CARD_WIDTH x CARD_HEIGHT space.
    const dpr = Math.min((typeof window !== "undefined" && window.devicePixelRatio) || 1, 2);
    canvas.width = CARD_WIDTH * dpr;
    canvas.height = CARD_HEIGHT * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    const colors = getThemeColors();
    const { font, radius, innerRadius, elevation } = await resolveCardMetrics();

    // Background
    ctx.fillStyle = colors.bg;
    roundRect(ctx, 0, 0, CARD_WIDTH, CARD_HEIGHT, radius);
    ctx.fill();

    // Border
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1.5;
    roundRect(ctx, 0.75, 0.75, CARD_WIDTH - 1.5, CARD_HEIGHT - 1.5, radius);
    ctx.stroke();

    // --- Hero section ---
    const heroY = PADDING + 60;

    // Left: Percentile
    const percentile = computePercentile(data.wpm);
    ctx.textAlign = "left";
    ctx.fillStyle = colors.accent;
    ctx.font = `bold 48px ${font}`;
    ctx.fillText(`Top ${100 - percentile}%`, PADDING, heroY);
    ctx.fillStyle = colors.textSubtle;
    ctx.font = `14px ${font}`;
    ctx.fillText("of coders", PADDING, heroY + 24);

    // Center: WPM large
    ctx.textAlign = "center";
    ctx.fillStyle = colors.accent;
    ctx.font = `bold 120px ${font}`;
    ctx.fillText(`${Math.round(data.wpm)}`, CARD_WIDTH / 2, heroY + 10);
    ctx.fillStyle = colors.textSubtle;
    ctx.font = `bold 18px ${font}`;
    ctx.fillText("WPM", CARD_WIDTH / 2, heroY + 40);

    // New-best marker beneath the WPM hero
    if (data.isNewBest) {
        const markerText = bestDelta(data.wpm, data.bestWpm) > 0
            ? `★ NEW BEST  +${bestDelta(data.wpm, data.bestWpm)}`
            : "★ NEW BEST";
        ctx.textAlign = "center";
        ctx.font = `bold 18px ${font}`;
        const textW = ctx.measureText(markerText).width;
        const padX = 16;
        const badgeW = textW + padX * 2;
        const badgeH = 30;
        const badgeX = CARD_WIDTH / 2 - badgeW / 2;
        const badgeY = heroY + 54;
        ctx.fillStyle = colors.accent;
        roundRect(ctx, badgeX, badgeY, badgeW, badgeH, badgeH / 2);
        ctx.fill();
        ctx.fillStyle = colors.bg;
        ctx.fillText(markerText, CARD_WIDTH / 2, badgeY + 21);
    }

    // Right: Syntax score (patternScore) or accuracy label
    const syntaxVal = data.patternScore !== undefined
        ? `${data.patternScore}`
        : `${Math.round(data.accuracy * 100)}%`;
    const syntaxLabel = data.patternScore !== undefined ? "Syntax Score" : "Accuracy";
    ctx.textAlign = "right";
    ctx.fillStyle = colors.text;
    ctx.font = `bold 48px ${font}`;
    ctx.fillText(syntaxVal, CARD_WIDTH - PADDING, heroY);
    ctx.fillStyle = colors.textSubtle;
    ctx.font = `14px ${font}`;
    ctx.fillText(syntaxLabel, CARD_WIDTH - PADDING, heroY + 24);

    // --- Meta pills ---
    const pillY = heroY + 80;
    const pillStr = [
        data.snippetTitle,
        data.language.toUpperCase(),
        capitalize(data.difficulty),
    ].join("  ·  ");
    ctx.font = `13px ${font}`;
    ctx.textAlign = "center";
    ctx.fillStyle = colors.textSubtle;
    ctx.fillText(pillStr, CARD_WIDTH / 2, pillY);

    // Divider
    const dividerY = pillY + 24;
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PADDING, dividerY);
    ctx.lineTo(CARD_WIDTH - PADDING, dividerY);
    ctx.stroke();

    // --- Rich graph ---
    const graphX = PADDING;
    const graphY = dividerY + 24;
    const graphW = CARD_WIDTH - PADDING * 2;
    const graphH = 340;

    if (data.history.length > 1) {
        drawRichGraph(ctx, colors, { font, radius: innerRadius, elevation }, graphX, graphY, graphW, graphH, data.history);
    }

    // --- Bottom stats row ---
    const statsY = graphY + graphH + 40;
    const statSpacing = (CARD_WIDTH - PADDING * 2) / 3;

    // Raw WPM
    ctx.textAlign = "center";
    ctx.fillStyle = colors.text;
    ctx.font = `bold 32px ${font}`;
    ctx.fillText(`${Math.round(data.rawWpm)}`, PADDING + statSpacing * 0.5, statsY);
    ctx.fillStyle = colors.textSubtle;
    ctx.font = `12px ${font}`;
    ctx.fillText("RAW", PADDING + statSpacing * 0.5, statsY + 20);

    // Accuracy
    ctx.fillStyle = colors.text;
    ctx.font = `bold 32px ${font}`;
    ctx.fillText(`${Math.round(data.accuracy * 100)}%`, PADDING + statSpacing * 1.5, statsY);
    ctx.fillStyle = colors.textSubtle;
    ctx.font = `12px ${font}`;
    ctx.fillText("ACCURACY", PADDING + statSpacing * 1.5, statsY + 20);

    // Time
    ctx.fillStyle = colors.text;
    ctx.font = `bold 32px ${font}`;
    ctx.fillText(formatDuration(data.timeMs), PADDING + statSpacing * 2.5, statsY);
    ctx.fillStyle = colors.textSubtle;
    ctx.font = `12px ${font}`;
    ctx.fillText("TIME", PADDING + statSpacing * 2.5, statsY + 20);

    // --- Footer ---
    const footerY = CARD_HEIGHT - PADDING + 8;
    ctx.textAlign = "left";
    ctx.fillStyle = colors.accent;
    ctx.font = `bold 16px ${font}`;
    ctx.fillText("CodeSprint", PADDING, footerY);
    // Right-aligned, otherwise the URL runs off the edge of the card.
    ctx.textAlign = "right";
    ctx.fillStyle = colors.textSubtle;
    ctx.font = `14px ${font}`;
    ctx.fillText("codesprint.dev", CARD_WIDTH - PADDING, footerY);

    return canvas;
}

function drawRichGraph(
    ctx: CanvasRenderingContext2D,
    colors: ThemeColors,
    style: { font: string; radius: number; elevation: Elevation },
    x: number,
    y: number,
    width: number,
    height: number,
    history: { time: number; wpm: number }[],
) {
    if (history.length < 2) return;
    const { font, radius, elevation } = style;

    const wpmValues = history.map((h) => h.wpm);
    const minWpm = Math.max(0, Math.min(...wpmValues) - 10);
    const maxWpm = Math.max(...wpmValues) + 10;
    const range = maxWpm - minWpm || 1;
    const peakWpm = Math.max(...wpmValues);
    const innerPad = 32;
    const plotX = x + innerPad;
    const plotY = y + 12;
    const plotW = width - innerPad * 2;
    const plotH = height - 32;

    // Background area, lifted with the theme's own card elevation.
    ctx.save();
    if (elevation) {
        ctx.shadowColor = elevation.color;
        ctx.shadowBlur = elevation.blur;
        ctx.shadowOffsetY = elevation.offsetY;
    }
    ctx.fillStyle = colors.surface;
    roundRect(ctx, x, y, width, height, radius);
    ctx.fill();
    ctx.restore();

    // Grid lines (horizontal, 5 lines)
    const gridCount = 5;
    ctx.setLineDash([4, 6]);
    ctx.lineWidth = 1;
    for (let i = 0; i <= gridCount; i++) {
        const gy = plotY + (i / gridCount) * plotH;
        const wpmLabel = Math.round(maxWpm - (i / gridCount) * range);
        ctx.strokeStyle = colors.border;
        ctx.beginPath();
        ctx.moveTo(plotX, gy);
        ctx.lineTo(plotX + plotW, gy);
        ctx.stroke();

        // Y-axis label with accent dot
        ctx.setLineDash([]);
        ctx.fillStyle = colors.accent;
        ctx.beginPath();
        ctx.arc(plotX - 10, gy, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = colors.textSubtle;
        ctx.font = `11px ${font}`;
        ctx.textAlign = "right";
        ctx.fillText(`${wpmLabel}`, plotX - 16, gy + 4);
        ctx.setLineDash([4, 6]);
    }
    ctx.setLineDash([]);

    // Helper to get point coordinates
    const ptX = (i: number) => plotX + (i / (history.length - 1)) * plotW;
    const ptY = (wpm: number) => plotY + plotH - ((wpm - minWpm) / range) * plotH;

    // Gradient fill under the line
    const gradient = ctx.createLinearGradient(x, plotY, x, plotY + plotH);
    gradient.addColorStop(0, `${colors.accent}33`);
    gradient.addColorStop(1, `${colors.accent}00`);

    ctx.beginPath();
    ctx.moveTo(ptX(0), ptY(history[0].wpm));
    for (let i = 1; i < history.length; i++) {
        ctx.lineTo(ptX(i), ptY(history[i].wpm));
    }
    ctx.lineTo(ptX(history.length - 1), plotY + plotH);
    ctx.lineTo(ptX(0), plotY + plotH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Accent line with round joins
    ctx.beginPath();
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.moveTo(ptX(0), ptY(history[0].wpm));
    for (let i = 1; i < history.length; i++) {
        ctx.lineTo(ptX(i), ptY(history[i].wpm));
    }
    ctx.stroke();

    // Peak WPM dashed line
    const peakY = ptY(peakWpm);
    ctx.setLineDash([6, 8]);
    ctx.strokeStyle = `${colors.accent}88`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotX, peakY);
    ctx.lineTo(plotX + plotW, peakY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = colors.accent;
    ctx.font = `bold 11px ${font}`;
    ctx.textAlign = "right";
    ctx.fillText(`Peak ${Math.round(peakWpm)} WPM`, plotX + plotW - 4, peakY - 6);

    // Data point markers: outer ring + inner dot
    for (let i = 0; i < history.length; i++) {
        const px = ptX(i);
        const py = ptY(history[i].wpm);

        // Outer ring
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fillStyle = colors.bg;
        ctx.fill();
        ctx.strokeStyle = colors.accent;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Inner dot
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fillStyle = colors.accent;
        ctx.fill();
    }
}

function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

// ---------------------------------------------------------------------------
// Sharing utilities
// ---------------------------------------------------------------------------

export async function shareCard(canvas: HTMLCanvasElement, data: ShareCardData): Promise<void> {
    const blob = await canvasToBlob(canvas);
    const textSummary = generateTextSummary(data);

    // Try Web Share API first
    if (navigator.share && navigator.canShare) {
        const file = new File([blob], "codesprint-result.png", { type: "image/png" });
        const shareData = { text: textSummary, files: [file] };

        if (navigator.canShare(shareData)) {
            try {
                await navigator.share(shareData);
                return;
            } catch {
                // User cancelled or share failed — fall through to clipboard
            }
        }
    }

    // Fallback: copy image to clipboard
    try {
        await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob }),
        ]);
    } catch {
        // Final fallback: download
        downloadCanvas(canvas);
    }
}

export function downloadCanvas(canvas: HTMLCanvasElement): void {
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = "codesprint-result.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

export function generateTextSummary(data: ShareCardData): string {
    const parts = [
        "CodeSprint",
        `${data.snippetTitle} (${data.language.toUpperCase()}, ${capitalize(data.difficulty)})`,
        `${Math.round(data.wpm)} WPM`,
        `${Math.round(data.accuracy * 100)}% accuracy`,
    ];
    if (data.patternScore !== undefined) {
        parts.push(`Pattern: ${data.patternScore}/100`);
    }
    parts.push("codesprint.dev");
    return parts.join(" | ");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Failed to create blob"));
        }, "image/png");
    });
}

function capitalize(s: string): string {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

function formatDuration(ms: number): string {
    const s = ms / 1000;
    if (s < 60) return `${s.toFixed(1)}s`;
    return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}
