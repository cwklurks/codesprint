# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Performance

- Load selected Monaco contributions instead of `editor.all`. The idle page loads 980 KB less uncompressed JavaScript, or 260 KB less with local gzip, an 18.2% gzip reduction. Clipboard, context menus, syntax highlighting, and Vim support remain. See [measurement details](docs/performance.md).
- Build completed-text ranges from error boundaries instead of rescanning the typed prefix after each keystroke.
- Keep editor options stable and cache the session's editor-height calculation.

### Maintenance

- Remove redundant branches and implementation commentary. Correct the README's theme count and its claim that keystrokes don't trigger React renders.
- Add repeatable payload and range-building measurements, exhaustive range tests, and production browser coverage for all four languages and Vim attachment.

## [0.3.0] - 2026-08-28

The portfolio mega-polish: a full design, performance, accessibility, and
robustness overhaul, developed with layered adversarial review (independent
design/performance/quality audits, a hostile plan review, two independent
implementation reviews, and screenshot-driven browser QA).

### Design

- **Real typography.** JetBrains Mono ships via `next/font` with a single
  canonical `--font-mono` stack; previously no webfont was loaded and the app
  rendered in each OS's fallback mono. Monaco is told about the face and
  remeasures when it loads.
- **A real token system.** Radius, blur, and theme-derived elevation scales;
  shadows now cast in neutral black (they were tinted with the theme's own
  background and invisible). Chakra v3 is configured through `createSystem`
  so stock components inherit the theme instead of leaking default grays.
- **WCAG AA across all 17 themes**, enforced by tests: body text, muted text,
  accent, status colors, and terminal-mode backdrops all clear their floors.
  Botanical and serika were repaired rather than deleted.
- **CTA hierarchy fixed.** Start is the filled accent action with a
  contrast-derived label; Next problem is quiet in the top bar and primary on
  the result screen. The control bar is grouped with dividers and aria-pressed
  pills; a compact hero states what the product is without pushing the editor
  below the fold.
- **The result screen is choreographed**: staggered reveal, an exact-value WPM
  count-up, and a graph that draws in and actually fills its card. All motion
  respects `prefers-reduced-motion`.
- **One overlay language.** Every dialog and drawer: portal, dimmed blurred
  backdrop, readable glass surface, consistent close control. The theme picker
  shows a miniature typing line per theme.
- **Share card matches the app** (same face, radius, elevation; the clipped
  codesprint.dev watermark is fixed).

### Performance

- **First Load JS: 577 kB → ~220 kB (−62%).** Emotion SSR no longer emits the
  same stylesheet 13 times (prerendered HTML 1.1 MB → ~143 kB, −87%). Overlays,
  dashboards, and the result screen are code-split; snippet corpora load on
  demand and the daily pool waits for idle.
- **One Monaco.** `loader.config({ monaco })` uses the bundled editor; the
  second full copy previously fetched from a CDN (with version skew) is gone.
- **A calm typing loop.** The 100 ms full-tree re-render interval is replaced
  by an atomic finish snapshot; error decorations update only on real changes;
  the keyboard listener registers once; hot components are memoized with
  stable props.

### Accessibility

- Skip link, `main` landmark, single `h1`, labeled inputs, `aria-pressed`
  pills, live-region stat announcements that state values instead of masking
  them, and Tab reaching the browser from idle so keyboard users can navigate.

### Fixed

- Shift+A now opens AI drills from the result screen; in idle, shifted letters
  type (snippets start with capitals). The advertised shortcut previously did
  nothing at all.
- Overlay keyboard gate: dialog keys can no longer start or reset a run, and a
  narrow-viewport AI drill can no longer lock the keyboard.
- The AI generate route no longer 500s on `Origin: null`, requires a same-host
  origin, bounds every input, rejects oversized bodies, and accepts the app's
  own cold-start payload (the error-rate domain was misbounded).
- localStorage mirror keeps full records unless IndexedDB confirmed the write;
  quota exhaustion trims loudly instead of silently freezing.
- Paste works in inputs again (the global paste blocker no longer captures the
  API-key field). IndexedDB opens can no longer hang forever across tabs.
- Open Graph/Twitter images, PWA manifest with maskable icons, robots, sitemap,
  canonical URLs, and route-level error pages exist now.

### Technical

- 863 unit tests (was 629) plus an 8-spec Playwright suite that runs against a
  production build, completes a real typing session, and asserts a clean
  console with no hydration-error filtering.

## [0.2.0] - 2026-04-21

### Added

- **Cross-session weak-pattern dashboard** in the Analytics modal. New "Syntax Category Trends" section aggregates per-session error data across your entire history and shows which token categories (keywords, operators, delimiters, identifiers, literals, whitespace, comments, strings) are improving or declining. Each category gets a sparkline trend and a delta in percentage points. Top-3 improving and top-3 declining panels surface the biggest movers at a glance.
- Time range switching (Day, Week, Month, All Time) re-aggregates the dashboard against the selected window. "All Time" shows true all-time rates with "Stable" classifications when there's no earlier baseline to compare against.
- Empty state prompts you to type more sessions when fewer than 10 sessions-with-error-data exist.

### Changed

- Bumped project version to 0.2.0.

### Technical

- New pure module `lib/analytics/weak-pattern-trends.ts` (187 lines) with 20 unit tests covering all branches.
- New component `components/analytics/WeakPatternDashboard.tsx` with 2 smoke tests for empty and populated states.
- Per-snippet tokenization cached within a single aggregation call (keyed by content hash, so sync:leetcode refreshes don't serve stale maps).
- Period-over-period trend classification requires comparable data in both windows — forces "stable" when the previous window is empty.
- No IndexedDB schema changes. Old session records without `errors` or `snippetContent` are silently skipped, not crashed.
- `vitest.config.ts` gains `esbuild.jsx: "automatic"` so React 19 JSX renders in component tests without requiring an explicit `import React`.
