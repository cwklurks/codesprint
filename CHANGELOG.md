# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
