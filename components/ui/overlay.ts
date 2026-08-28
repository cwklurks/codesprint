import type { BoxProps } from "@chakra-ui/react";

/**
 * One overlay language for every dialog and drawer in the app.
 *
 * Portal + dimmed blurred backdrop + a soft panel surface at the top elevation.
 * Spread these into `DialogBackdrop` / `DialogContent` / `DrawerContent` instead
 * of restating the same handful of vars in each overlay.
 */

/** Dimmed, lightly blurred scrim. Tinted with the theme bg so it reads warm/cool per theme. */
export const overlayBackdropProps = {
    bg: "color-mix(in srgb, var(--bg) 66%, transparent)",
    backdropFilter: "blur(var(--blur-sm))",
} satisfies BoxProps;

/**
 * `--panel-soft` is a translucent tint (alpha ~0.24), so on its own an overlay
 * lets the editor bleed straight through the copy. Layering it over a near-opaque
 * theme background keeps the glass character while the text stays readable.
 */
const overlaySurfaceBase = {
    bg: "linear-gradient(var(--panel-soft), var(--panel-soft)), color-mix(in srgb, var(--bg) 92%, transparent)",
    backdropFilter: "blur(var(--blur-md))",
    boxShadow: "var(--elev-3)",
    color: "var(--text)",
} satisfies BoxProps;

/** Centered dialogs: full frame, large radius. */
export const overlayDialogProps = {
    ...overlaySurfaceBase,
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
} satisfies BoxProps;

/** Edge drawers: only the inner edge is a visible seam. */
export const overlayDrawerProps = {
    ...overlaySurfaceBase,
    borderLeft: "1px solid var(--border)",
} satisfies BoxProps;

/** Shared seams so headers and footers line up across overlays. */
export const overlayHeaderProps = {
    borderBottom: "1px solid var(--border)",
} satisfies BoxProps;

export const overlayFooterProps = {
    borderTop: "1px solid var(--border)",
} satisfies BoxProps;

/** Small uppercase section label used inside overlays. */
export const overlayEyebrowProps = {
    fontSize: "2xs",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "var(--text-subtle)",
} satisfies BoxProps;
