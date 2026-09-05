# Editor performance

Measured against `839edb9`, the previous `main`, using production builds and a fresh Chromium browser cache. No dependencies were added.

## Page load

| JavaScript loaded by the idle page | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| Uncompressed bytes | 5,527,267 | 4,547,471 | 17.7% |
| Locally gzipped bytes | 1,428,506 | 1,168,328 | 18.2% |
| Requests | 36 | 34 | 2 |

These totals include lazy-loaded Monaco, its worker, and snippet data. Next's route-level First Load JS stays at about 220 kB because it excludes those later requests. The after result was identical across three fresh-browser runs. Gzip sizes are computed from response bodies, not measured network transfer sizes. This is a payload comparison, not a claim about load-time or typing-latency percentages.

`CodePanel` no longer imports `editor.all`. It keeps tokenization, navigation, find, clipboard, context menus, and the commands referenced by monaco-vim. Completion, inline suggestions, rename, code lenses, and color pickers are no longer registered or bundled through that import.

To reproduce, build and start the app, then run the measurement in a second terminal:

```sh
npm run build
npm start
# Second terminal:
node scripts/measure-load.mjs http://localhost:3000
```

Use the same script and dependency installation on the baseline checkout for the before measurement. The browser must be able to start, and the URL must point to this production build.

## Completed-text ranges

Previously, each cursor update scanned every character before the cursor to find completed ranges. Now the scan visits only sorted error positions. Sorting happens when the error set changes, not on every correct keystroke. A perfect prefix needs one range regardless of its length.

An isolated Bun benchmark advances through every cursor position in a synthetic snippet. Seven timed trials follow one warm-up; the table reports medians from one local run.

| Characters | Errors | Old prefix scan | Error-boundary scan |
| --- | ---: | ---: | ---: |
| 1,000 | 0 | 0.661 ms | 0.130 ms |
| 1,000 | 10 | 0.647 ms | 0.296 ms |
| 10,000 | 0 | 31.339 ms | 0.678 ms |
| 10,000 | 10 | 44.765 ms | 0.960 ms |

```sh
bun scripts/benchmark-decorations.ts
```

The benchmark excludes React, Monaco decoration application, painting, and sorting a changed error set. It does not measure end-to-end keystroke latency. The 10,000-character case is a stress test, not a typical practice snippet.

Editor options also retain their identity across keystrokes, and the session caches its editor-height calculation instead of splitting the snippet on every render.

## Verification

- 931 unit tests pass, including exhaustive highlighting comparisons across all 256 error sets in an eight-character snippet and every cursor position.
- 13 production Chromium tests pass. Added checks cover syntax colors, errors, backspace corrections, and completion in all four languages, plus Vim attachment and Visual mode after a snippet change.
- Production build, TypeScript validation, and ESLint pass.

Vim's existing read-only model does not enter Insert mode. The new browser test covers Normal and Visual mode, not Insert mode. This change does not alter that behavior.
