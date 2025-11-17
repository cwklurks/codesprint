
<h1 align="center">CodeSprint</h1>

<p align="center">
  Typing dojo for engineers who want real code, live stats, and zero fluff.
</p>

<p align="center">
  ⚡ Real-world LeetCode snippets · 🔢 Live WPM & accuracy · 🎯 Keyboard-first UX
</p>

<p align="center">
  <a href="#quickstart">Quickstart</a> · <a href="#why-codesprint">Why CodeSprint</a> · <a href="#architecture-map">Architecture</a> · <a href="#contributing">Contributing</a>
</p>

---

## Why CodeSprint

Most typing tests throw lorem ipsum at you. CodeSprint serves production-grade LeetCode snippets, keeps the chrome minimal, and scores you in real time so you can build muscle memory for the code you actually write. It’s built for engineers who are:

- prepping for interviews or code screens and need fluency, not filler
- keeping their typing sharp on familiar syntax (TypeScript, Python, etc.)
- eager for a keyboard-first experience that stays out of the way

### Feature snapshot

- **Real snippets, no noise:** Monaco-powered editor seeded with curated problem sets.
- **Live metrics:** WPM, accuracy, and error streaks update as you type.
- **Focus mode:** Chakra UI shell that keeps attention on the keys and the code.

## Sneak peek

[![CodeSprint preview placeholder](https://via.placeholder.com/1200x680?text=CodeSprint+Preview)](https://via.placeholder.com/1200x680?text=CodeSprint+Preview)  
_Swap in a screenshot or GIF of the typing session once you capture it._

## Quickstart

### Prerequisites

- Node.js 20+ (18+ works, but 20 is the target runtime)
- `npm` or `pnpm` for package management
- [`bun`](https://bun.sh/) if you plan to sync LeetCode snippets (`npm run sync:leetcode`)

### Install & run locally

```bash
# Install dependencies
npm install

# Start the dev server (http://localhost:3000)
npm run dev
```

Other useful scripts:

```bash
# Type-check & bundle for production
npm run build

# Serve the built app
npm run start

# Lint with the shared config
npm run lint

# Refresh the LeetCode snippet catalog (requires bun)
npm run sync:leetcode
```

## How it works

1. Land on the single-page experience rendered from `app/page.tsx`.
2. CodeSprint drops you into a Monaco instance seeded with the current snippet.
3. Start typing—`TypingSession` tracks keystrokes, diffs against the target, and streams metrics.
4. `LiveStats` mirrors WPM, accuracy, and streaks in real time.
5. Finish the snippet (or bail), and `ResultCard` wraps the run with a summary and restart CTA.

## Keyboard shortcuts

These shortcuts work outside of an active run:

| Key | Action |
| --- | --- |
| `R` | Reset the session and load a fresh run |
| `N` | Jump to the next snippet |
| `L` | Toggle the live stats panel |
| `P` | Pop open preferences |
| `Esc` | Abort the current run |

## Architecture map

### Core directories

- `app/` – Next.js App Router entry point, layouts, providers, and the main page shell.
- `components/` – React 19 function components:
  - `AppShell`, `ShortcutsDrawer`, `PreferencesDrawer` for chrome & drawers
  - `TypingSession`, `CodePanel`, `LiveStats`, `ResultCard` for the typing flow
- `lib/` – Framework-agnostic logic: scoring, snippet loading, motion presets, and preference persistence.
- `data/leetcode-snippets.json` – Curated LeetCode catalog served into sessions.
- `scripts/sync-leetcode.ts` – Keeps the snippet catalog up-to-date (invoked via Bun).

### Session lifecycle

1. `TypingSession` requests the next snippet via `@/lib/snippets`.
2. Keystrokes run through `@/lib/scoring` to compute accuracy, WPM, and error streaks.
3. Preferences from `@/lib/preferences` shape the experience (theme, font, motion, sound).
4. `LiveStats` and `ResultCard` subscribe to the session state and render updates with Chakra UI + Framer Motion.

## Snippets & data

- Snippets live in `data/leetcode-snippets.json`, curated to stay interesting and relevant.
- Run `npm run sync:leetcode` (requires Bun) to hit LeetCode and refresh the catalog.
- Each snippet includes metadata (problem ID, title, language) so future filters and playlists stay open-ended.

## Preferences & personalization

- `PreferencesDrawer` gives engineers control over themes, font sizes, motion, sound, and difficulty.
- Preferences are stored client-side via `@/lib/preferences`, so you keep your setup across sessions.
- Motion presets respect reduced-motion settings via `@/lib/motion`.

## Scripts & tooling

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Turbopack dev server with hot reload |
| `npm run build` | Produce a production bundle |
| `npm run start` | Serve the production build locally |
| `npm run lint` | Run ESLint with the repo config |
| `npm run sync:leetcode` | Refresh snippets using the Bun-powered sync script |

## Contributing

We welcome pull requests for fresh snippets, UX polish, and new stat visualizations. A few tips:

- Stick to TypeScript + React function components; add `"use client"` only when you need hooks.
- Reach for Chakra UI primitives before hand-rolling styles.
- Keep shared logic in `lib/`; keep components lean and composable.
- Run `npm run lint` before opening a PR to match the shared style rules.
- New here? `AGENTS.md` contains a deeper dive on architecture conventions.

## Roadmap

- Expanded snippet catalog by language (Go, Rust, SQL).
- Profiles with historical run tracking and personal bests.
- Multiplayer ghost runs and team leaderboards.
- Sound, haptics, and streamer-friendly overlays.
- Offline mode with cached snippet packs.

## License

This repository has not published a license yet. Please reach out to the maintainers before reusing the code.

## Acknowledgements

- Inspired by the documentation patterns in [awesome-readme](https://github.com/matiassingers/awesome-readme).
- Built with Next.js 15, React 19, Chakra UI 3, Framer Motion, and Monaco Editor.
