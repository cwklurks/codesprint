<h1 align="center">CodeSprint</h1>

<p align="center">
  <a href="https://nextjs.org/">
    <img src="https://img.shields.io/badge/Next.js-15-black?style=flat&logo=nextdotjs&logoColor=white" alt="Next.js 15">
  </a>
  <a href="https://react.dev/">
    <img src="https://img.shields.io/badge/React-19-61dafb?style=flat&logo=react&logoColor=white" alt="React 19">
  </a>
  <a href="https://microsoft.github.io/monaco-editor/">
    <img src="https://img.shields.io/badge/Monaco-Editor-blue?style=flat&logo=visualstudiocode&logoColor=white" alt="Monaco">
  </a>
</p>

![Image](https://github.com/user-attachments/assets/0fa880d2-714c-47cf-9c58-218524943d60)

<p align="center">
  <strong>A "muscle memory engine" for LeetCode patterns.</strong>
  <br>
  It syncs real problem snippets via a custom GraphQL scraper and scores your typing accuracy against the actual syntax trees.
</p>

<p align="center">
  <a href="#engineering">Engineering</a> · <a href="#the-data-pipeline">Data Pipeline</a> · <a href="#running-locally">Running Locally</a>
</p>

## Why?

Most typing tests are just `String.split(' ')`. They measure your ability to type English prose, not code.

I built CodeSprint because I realized people sometimes fail technical interviews not on logic, but on syntax fluency. I needed a way to drill "Depth First Search in Python" or "Ring Buffer in C++" until my fingers knew the shape of the code.

## Engineering

I wanted to create more than just a text area wrapper. Here is how I went about making it:

### 1. The Renderer (Monaco + Delta Decorations)

Instead of building a custom canvas renderer (yet), CodeSprint runs a heavily customized instance of the Monaco Editor (the core of VS Code).

- **Diffing**: It uses `deltaDecorations` to paint correct/incorrect keystrokes directly onto the editor model without breaking the underlying syntax highlighting.
- **Layout**: It calculates `getScrolledVisiblePosition` to overlay a really nice custom caret that behaves smoother than the native DOM caret.

### 2. The Sync Script (Bun)

I didn't really want to hardcode snippets. So, I wrote a custom scraper in Bun (`scripts/sync-leetcode.ts`) that:

- Reverse-engineers the LeetCode GraphQL schema.
- Fetches problems by difficulty and acceptance rate.
- Sanitizes the code (strips docstrings and excessive comments).
- Normalizes indentation to standard 4-space tabs.

### 3. The Latency Fight

React's render cycle is often too slow for a 100 WPM feedback loop. The typing engine (`hooks/useTypingEngine.ts`) isolates the keystroke logic from the React render tree where possible, only triggering re-renders for specific UI updates (like the WPM gauge) to avoid garbage collection pauses during typing bursts.

## The Data Pipeline

To keep the snippets fresh, you can run the sync script locally:

```bash
# Requires Bun (https://bun.sh)
npm run sync:leetcode -- --limit 50 --difficulties medium,hard
```

This will:

- Query the LeetCode `questionData` endpoint.
- Parse `codeSnippets` for C++, Java, Python, and JS.
- Output a minified JSON catalog to `data/leetcode-snippets.json`.
- Autosort them into short, medium, and long problems.

## Running Locally

```bash
# Install dependencies
npm install

# Start the Next.js 15 Turbopack server
npm run dev
```

Open http://localhost:3000.

## Roadmap

- **Custom Renderer**: Migrating from Monaco to a custom WebGL/Canvas text renderer to support large files with zero DOM overhead (Gap Buffer implementation in progress).
- **Parser Integration**: Using Tree-sitter to allow "semantic typing" (skipping whitespace/formatting irrelevant to the code logic).

## License

MIT.
