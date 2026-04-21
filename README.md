<div align="center">

<h1>CodeSprint</h1>

<p>
  <a href="https://nextjs.org/">
    <img src="https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js 15">
  </a>
  <a href="https://react.dev/">
    <img src="https://img.shields.io/badge/React-19-61dafb?style=for-the-badge&logo=react&logoColor=white" alt="React 19">
  </a>
  <a href="https://microsoft.github.io/monaco-editor/">
    <img src="https://img.shields.io/badge/Monaco-Editor-007ACC?style=for-the-badge&logo=visualstudiocode&logoColor=white" alt="Monaco Editor">
  </a>
</p>

<br>

<img src="https://github.com/user-attachments/assets/0fa880d2-714c-47cf-9c58-218524943d60" alt="CodeSprint demo" width="100%">

<strong>A code typing trainer that builds real syntax muscle memory.</strong>
<br>
Practice 1,800+ real LeetCode snippets across Python, JavaScript, Java, and C++<br>with syntax-aware scoring, spaced repetition, and adaptive difficulty.

<p>
  <a href="#features">Features</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="#how-it-works">How It Works</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="#data-pipeline">Data Pipeline</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="#running-locally">Running Locally</a>
</p>

</div>

## Why?

Most typing tests measure how fast you can type English. That doesn't translate when you're writing code full of brackets, operators, and indentation.

CodeSprint exists because syntax fluency matters — in interviews and in daily work. It lets you drill patterns like "Depth First Search in Python" or "Ring Buffer in C++" until your fingers know the shape of the code.

> [!NOTE]
> CodeSprint runs entirely client-side. No account, no backend, no data leaves your browser.

## Features

<details open>
<summary><strong>Syntax-Aware Scoring</strong></summary>

<br>

CodeSprint tokenizes each snippet by language and weights different constructs differently:

- **Keywords** and **operators** — weighted 1.5×
- **Delimiters** (brackets, parens) — weighted 1.2×
- **Whitespace** — weighted 0.5×

You get three metrics per session: raw WPM, adjusted WPM (only perfect words), and a pattern score that reflects how well you nailed the actual code constructs.

</details>

<details open>
<summary><strong>Spaced Repetition</strong></summary>

<br>

Built on the SM-2 algorithm (the same one behind Anki). CodeSprint tracks per-snippet mastery and schedules reviews based on your performance. Snippets you struggle with come back sooner; ones you've nailed fade into longer intervals.

</details>

<details open>
<summary><strong>Adaptive Difficulty</strong></summary>

<br>

Tracks your proficiency per language and recommends what to practice next. Adjusts difficulty based on your recent accuracy and speed so you're always working at the edge of your ability.

</details>

<details>
<summary><strong>Achievements & Progression</strong></summary>

<br>

30+ achievements across speed, accuracy, consistency, and exploration categories with rarity tiers from common to legendary. An XP system with leveling tracks overall progress, and streak tracking keeps you coming back daily.

</details>

<details>
<summary><strong>Customizable Editor</strong></summary>

<br>

- 18+ color themes
- Vim mode support
- Configurable font size, caret width, and syntax highlighting level
- Panel mode or immersive/terminal mode for distraction-free practice
- Optional countdown timer before sessions

</details>

<details>
<summary><strong>Multi-Language Support</strong></summary>

<br>

1,800+ real snippets sourced from LeetCode problems across four languages (JavaScript, Python, Java, C++) and three difficulty tiers (easy, medium, hard), categorized by length.

</details>

## How It Works

### The Editor

CodeSprint runs a heavily customized Monaco Editor instance. It uses `deltaDecorations` to paint correct/incorrect keystrokes directly onto the editor model without breaking syntax highlighting, and overlays a custom caret that animates smoother than the native DOM cursor.

### The Typing Engine

React's render cycle is too slow for a 100+ WPM feedback loop. The typing engine (`hooks/useTypingEngine.ts`) isolates keystroke logic from the React render tree, only triggering re-renders for specific UI updates like the WPM gauge. Metrics are recalculated on a throttled interval rather than every keystroke.

### Storage

Everything runs client-side. Session history, achievements, mastery records, and XP live in IndexedDB with localStorage as a fallback for preferences. Data export is available in CSV and JSON formats.

## Data Pipeline

Snippets are sourced from LeetCode via a custom GraphQL scraper that reverse-engineers their API. To sync fresh snippets:

```bash
# Requires Bun (https://bun.sh)
npm run sync:leetcode -- --limit 50 --difficulties medium,hard
```

This queries the LeetCode `questionData` endpoint, extracts code snippets for all four languages, strips docstrings and excessive comments, normalizes indentation, and outputs a categorized JSON catalog.

After syncing, build the processed snippet files with tokenization metadata:

```bash
npm run build:snippets
```

## Running Locally

```bash
# Install dependencies
npm install

# Start the dev server (Next.js 15 + Turbopack)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

<details>
<summary><strong>Testing</strong></summary>

<br>

```bash
npm run test         # Unit tests (Vitest)
npm run test:watch   # Watch mode
npm run test:e2e     # E2E tests (Playwright)
```

</details>

<details>
<summary><strong>Production Build</strong></summary>

<br>

```bash
npm run build
npm start
```

</details>

## Roadmap

- **Custom Renderer** — Migrating from Monaco to a WebGL/Canvas text renderer for zero DOM overhead (Gap Buffer implementation in progress).
- **Tree-sitter Integration** — Semantic typing that lets you skip whitespace and formatting irrelevant to code logic.
- **Advanced Analytics** — Cross-session syntax category trend view with top-movers panels and sparklines (accessible via `A` / header icon). ✓ Shipped.

## License

MIT.
