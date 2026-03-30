# CodeSprint AI-Powered Drill Generation - Implementation Spec

**Version:** 2.1 (Implementation Update)
**Date:** 2026-03-29
**Status:** IN PROGRESS - Infrastructure Complete, UI Pending
**Last Updated:** All core AI infrastructure (lib/ai/, API route, hooks, preferences) implemented and building successfully. UI integration pending.
**Target:** CodeSprint 2.1.0 (Next.js 15.5.7 / React 19 / IndexedDB / Monaco / Chakra UI 3)

---

## Table of Contents

0. [How CodeSprint Works Today](#0-how-codesprint-works-today)
1. [Executive Summary](#1-executive-summary)
2. [Architecture](#2-architecture)
3. [Data Model Changes](#3-data-model-changes)
4. [New Files](#4-new-files)
5. [Modified Files](#5-modified-files)
6. [API Route: /api/generate](#6-api-route-apigenerate)
7. [AI SDK Integration](#7-ai-sdk-integration)
8. [Prompt Engineering](#8-prompt-engineering)
9. [Cross-Session Weak Pattern Aggregation](#9-cross-session-weak-pattern-aggregation)
10. [Response Validation Pipeline](#10-response-validation-pipeline)
11. [Client-Side Rate Limiting](#11-client-side-rate-limiting)
12. [Snippet Bridge: AI Drill to Snippet Type](#12-snippet-bridge-ai-drill-to-snippet-type)
13. [API Key Management (BYOK)](#13-api-key-management-byok)
14. [UI Components](#14-ui-components)
15. [Interaction State Table](#15-interaction-state-table)
16. [Design Specifications](#16-design-specifications)
17. [Preferences Extension](#17-preferences-extension)
18. [Export/Import Extension](#18-exportimport-extension)
19. [Testing Strategy](#19-testing-strategy)
20. [Migration & Backwards Compatibility](#20-migration--backwards-compatibility)
21. [Cost Analysis](#21-cost-analysis)
22. [Risk Register](#22-risk-register)
23. [Implementation Checklist](#23-implementation-checklist)
24. [Parallelization Strategy](#24-parallelization-strategy)
25. [NOT in Scope](#25-not-in-scope)
26. [Open TODOs](#26-open-todos)
27. [Review History](#27-review-history)

---

## 0. How CodeSprint Works Today

This section exists so anyone reading this spec cold can understand the system
they're extending. If you've built CodeSprint, skip to Section 1.

### What is CodeSprint?

CodeSprint is a **code typing trainer**. Users type real code snippets as fast
and accurately as possible to build muscle memory for programming syntax. Think
of it as Monkeytype, but for code instead of English prose.

It's a Next.js 15.5.7 app (React 19, App Router, Turbopack) deployed on Vercel.
All data lives client-side in IndexedDB (primary) and localStorage (fallback).
No backend, no auth, no accounts. The UI is built with Chakra UI 3.27.1 and
Framer Motion. The code editor uses Monaco Editor with optional Vim mode.

### The Typing Session Lifecycle

Everything starts in `components/TypingSession.tsx`, the single orchestrator
component. It composes ~13 hooks and manages the full session flow:

```
PHASE LIFECYCLE:
  "idle" ──→ "countdown" (optional, 3s) ──→ "running" ──→ "finished"
    │              │                            │               │
    │              │                            │               │
    └── User       └── Timer ticks              └── Cursor      └── Save session
        sees            down 3, 2, 1                reaches         Show ResultCard
        controls        Then auto-transition        end of          Update mastery
        + code          to "running"                snippet         Update skill model
```

During `"running"`, the `useTypingEngine` hook processes every keystroke:
- Tracks cursor position, wrong characters (as a `Set<number>`), error log
- Computes WPM every 1.5s, records history snapshots every 1s
- Handles tab-as-spaces, whitespace auto-advance, backspace
- Finishes when cursor reaches the end of the snippet content

When a session finishes (`"finished"` phase):
1. `useSessionLifecycle` saves the `SessionRecord` to IndexedDB
2. `useSpacedRepetition.updateMastery()` runs SM-2 on the snippet
3. `useAdaptiveDifficulty.updateSkillModel()` updates the EMA skill model
4. `ResultScreen` renders with `ResultCard` showing metrics

### How Scoring Works

`lib/scoring.ts` computes three metrics:

| Metric | Formula | What it means |
|--------|---------|---------------|
| **Raw WPM** | `(totalKeystrokes / 5) / minutes` | How fast you typed overall |
| **Adjusted WPM** | `(correctProgress / 5) / minutes` | How fast you typed correctly (only fully error-free "words" count) |
| **Pattern Score** | `((totalWeight - errorWeight) / totalWeight) * 100` | 0-100, how well you handled weighted syntax categories |

The pattern score uses **token weights** from `lib/token-weights.ts`:

```
keyword:    1.5    (most important - if, for, class, def)
operator:   1.5    (==, !=, &&, ||, =>)
delimiter:  1.2    ({, }, (, ), [, ], ;, :)
identifier: 1.0    (variable names, function names)
literal:    1.0    (numbers, true/false)
string:     0.8    (quoted text)
whitespace: 0.5    (spaces, tabs, newlines)
comment:    0.3    (// and /* */)

Per-language overrides:
  Python:   whitespace bumped to 0.7 (indentation is syntax)
  C++:      operator bumped to 1.6, delimiter to 1.3
```

Errors in high-weight categories hurt your pattern score more. This is how
CodeSprint identifies your weak spots.

### How Pattern Analysis Works

`lib/pattern-analysis.ts` takes the raw error log from a typing session and
identifies which token categories you struggle with most:

```
Input:  errors[] (positions where user typed wrong char)
      + tokens[] (tokenized snippet with categories per char)
      + language (for weight lookup)

Process:
  1. For each error position, look up what token category it belongs to
  2. Count errors per category
  3. Weight by token importance (keywords matter more than comments)
  4. Sort by weighted error rate

Output: Top 3 WeakPattern[] = [
    { category: "operator", errorRate: 0.12, label: "Operators" },
    { category: "delimiter", errorRate: 0.08, label: "Delimiters" },
    { category: "keyword", errorRate: 0.05, label: "Keywords" },
]
```

**Critical detail:** `analyzeWeakPatterns()` takes raw error positions and
tokens from a SINGLE session. It does NOT aggregate across sessions. The
AI drills feature needs a new aggregation layer (see Section 9).

### How Adaptive Difficulty Works

`lib/adaptive.ts` tracks a per-language skill model using exponential moving
average (EMA, alpha=0.3):

```
SKILL MODEL (per language):
  estimatedWpm: 40        (starts low, ramps up)
  estimatedAccuracy: 0.85
  currentDifficulty: "easy"
  confidenceLevel: 0      (0-1, reaches 1.0 after 20 sessions)
  sessionCount: 0
  consecutivePromotions: 0
  consecutiveDemotions: 0

PROMOTION (easy → medium → hard):
  accuracy > 92% AND
  wpm > estimatedWpm * 90% AND
  2+ consecutive good sessions AND
  confidence > 50%

DEMOTION (hard → medium → easy):
  accuracy < 78% OR wpm < estimatedWpm * 70%
  AND 1+ consecutive bad sessions
```

### How Spaced Repetition Works

`lib/spaced-repetition.ts` implements SM-2 (SuperMemo 2) for snippet mastery:

```
QUALITY RATING (from session results):
  5 = accuracy > 98% + patternScore > 90  (perfect)
  4 = accuracy > 95% + patternScore > 80  (great)
  3 = accuracy > 90%                       (good enough to advance)
  2 = accuracy > 80%                       (struggling)
  1 = accuracy > 70%                       (poor)
  0 = accuracy <= 70%                      (failing)

SM-2 INTERVALS:
  Quality >= 3: advance (1 day, 6 days, then interval * easeFactor)
  Quality < 3:  reset to 1 day, 0 repetitions

MASTERY STATUS:
  "new"      = never reviewed (nextReviewDate = "9999-12-31")
  "learning" = reviewed but interval < 21 days
  "due"      = nextReviewDate <= today
  "mastered" = interval >= 21 days
```

When SR is enabled, `useSessionControls.handleNextProblem()` checks for due
snippets before random selection.

### How Snippets Are Structured

```typescript
type Snippet = {
    id: string;
    problemId: string;         // "{language}:{sourceSlug}"
    title: string;
    content: string;           // the actual code to type
    language: SupportedLanguage;
    lengthCategory: SnippetLength;
    difficulty: Difficulty;
    lines: number;
};

// Length classification:
//   short:  <= 10 lines
//   medium: <= 30 lines
//   long:   > 30 lines
```

**Snippet corpus:**

| Source | JS | Python | Java | C++ | Total |
|--------|-----|--------|------|-----|-------|
| Curated (hand-written) | 2 | 5 | 3 | 1 | 14* |
| LeetCode (processed) | 15 | 123 | 2,850 | 2,850 | 5,838 |

*Some curated snippets have multiple length variants (short/medium/long).

The JS and Python numbers are low because `isSkeletal()` filters out
LeetCode stub solutions (class definitions with empty method bodies).
**This content gap is the primary motivation for AI-generated drills.**

Snippets are loaded from pre-built JSON files (`data/snippets-{language}.json`)
via dynamic import. The current language loads immediately; others load in the
background via `requestIdleCallback`.

### How the UI Is Structured

```
AppShell (sticky header, modals, PreferencesProvider)
  │
  ├── Header
  │   ├── Logo ("codesprint.dev")
  │   ├── Streak badge (fire + count)
  │   ├── Level + XP progress bar
  │   └── Icon buttons (Achievements, Analytics, Shortcuts, GitHub, Preferences)
  │
  └── TypingSession (the page content)
      │
      ├── [phase != "finished"]
      │   ├── SessionControlBar
      │   │   ├── Language pills: [JavaScript] [Python] [Java] [C++]
      │   │   ├── Length pills: [All] [Short] [Medium] [Long]
      │   │   ├── Surface pills: [Framed] [Immersive]
      │   │   ├── SR due count badge (when enabled)
      │   │   ├── Adaptive difficulty suggestion (when enabled)
      │   │   └── Start button (only in "idle" phase)
      │   │
      │   ├── SessionTopBar
      │   │   ├── ProgressIndicator (animated progress bar)
      │   │   ├── Problem title ("Now practicing: Binary Search")
      │   │   └── Next problem button (N or Q key)
      │   │
      │   ├── LiveStats (WPM/accuracy overlay during "running", optional)
      │   │
      │   └── CodePanel (Monaco Editor, dynamic import, SSR disabled)
      │       ├── Syntax highlighting (theme-aware)
      │       ├── Custom caret (width configurable)
      │       └── Vim mode (optional, via monaco-vim)
      │
      └── [phase == "finished"]
          └── ResultScreen (AnimatePresence crossfade)
              ├── ResultCard (WPM, accuracy, pattern score, graph)
              ├── XP gained display
              ├── Achievement badges (newly unlocked)
              ├── Difficulty transition notice
              └── Share/Download buttons
```

**Key UI patterns used in the existing codebase:**
- **Pill selectors:** For language, length, surface style. Chakra button groups.
- **Modals:** For analytics, leaderboard, achievement gallery. Chakra DialogRoot.
- **Drawers:** For preferences, shortcuts. Chakra DrawerRoot, right side, size "sm".
- **Animations:** Framer Motion AnimatePresence with crossfade transitions.
- **Themes:** 17 dark theme presets. Each theme defines CSS custom properties
  (panel bg, text, accent, caret, etc.) via `createThemeInitScript()` that
  runs before first paint to avoid flash.
- **Responsive:** Desktop-first. The app requires a keyboard to function.

### Data Storage

```
IndexedDB ("codesprint", version 2)
├── sessions        (keyPath: "id", indexes: by-date, by-language, by-snippet)
├── mastery         (keyPath: "snippetId", index: by-language)
├── achievements    (keyPath: "id")
├── custom-snippets (keyPath: "id")        ← AI drills will go here
├── meta            (keyPath: "key")
└── skill-models    (keyPath: "language")

localStorage
├── "codesprint-session-history"    (mirror of IDB sessions, max 500)
├── "codesprint-preferences"        (full PreferencesState)
└── (no API keys yet)               ← AI drill keys will go here
```

All IDB operations are async with SSR-safe guards. localStorage is used as
a fallback and for synchronous reads (analytics, leaderboard).

### Preferences

17 settings stored in localStorage. `sanitizePreferences()` validates every
field and applies defaults for missing/invalid values, making preference
migrations automatic (just add new fields with defaults).

```
Current preferences:
  theme: "gruvbox"              (17 dark presets)
  fontSize: 24                  (16-36px)
  caretWidth: 3                 (2-6px)
  countdownEnabled: false
  surfaceStyle: "immersive"     ("panel" | "immersive")
  showLiveStatsDuringRun: true
  interfaceMode: "ide"          ("ide" | "terminal")
  requireTabForIndent: false
  syntaxHighlighting: "full"    ("full" | "partial" | "none")
  vimMode: false
  debugGapBuffer: false
  spacedRepetitionEnabled: false
  adaptiveDifficultyEnabled: false
  (AI drill preferences will be added here)
```

### What the AI Drills Feature Connects To

Every existing system feeds into or benefits from AI-generated drills:

```
EXISTING SYSTEMS → AI DRILLS → EXISTING SYSTEMS
───────────────────────────────────────────────
Pattern analysis → identifies weak spots → feeds prompt builder
Token weights   → defines what's hard  → weights prompt focus
Adaptive diff   → current skill level  → sets drill difficulty
Spaced rep      → mastery tracking     → AI drills participate in SR
Tokenizer       → scores any code      → validates generated drills
Snippet system  → type definitions     → AI drills bridge to Snippet type
Session history → stores results       → AI drill results saved normally
```

The AI drill is not a separate feature. It's a new snippet SOURCE that plugs
into every existing system. When a user types an AI-generated drill, the same
tokenizer scores it, the same pattern analysis identifies weak spots, the same
SM-2 algorithm tracks mastery, and the same adaptive difficulty adjusts. The
only new work is: generating the snippet, validating it, and presenting it.

---

## 1. Executive Summary

Add AI-generated, personalized coding drills to CodeSprint. The AI generates
5-30 line code snippets that target the user's weakest token categories
(operators, keywords, delimiters, etc.) as identified by the existing pattern
analysis system.

**BYOK model:** User provides their own Claude or OpenAI API key. Key stored
in localStorage, sent per-request to a Next.js API route that proxies the
call to the AI provider. No backend infrastructure, no auth, no billing.

**Why this matters:** CodeSprint has 5,838 processed snippets, but the
distribution is brutal: JavaScript has 15, Python has 123, while Java and
C++ have 2,850 each. AI generation solves the content gap and adds
personalization on top.

---

## 2. Architecture

```
+----------------------------------------------------------+
|                    Browser (Client)                       |
|                                                           |
|  +------------+  +-----------+  +----------------------+  |
|  | Session     |  | Skill     |  | AIDrillPanel         |  |
|  | Control     |  | Model     |  | (Chakra Modal)       |  |
|  | Bar         |  | Feed      |  |                      |  |
|  +------+-----+  +-----+-----+  +----------+-----------+  |
|         |              |                    |              |
|         |              v                    |              |
|         |    aggregateWeakPatterns()        |              |
|         |              |                    |              |
|         |              +--------------------+              |
|         |                       |                          |
|  +------v-----------------------v---------+                |
|  | useAIDrills hook                       |                |
|  | - generateDrill()                      |                |
|  | - acceptDrill() -> save to IDB         |                |
|  | - rejectDrill()                        |                |
|  +--------------------+------------------+                 |
|                       |                                    |
+----------------------------------------------------------+
                        | POST /api/generate
                        | Authorization: Bearer <user-key>
                        v
+----------------------------------------------------------+
|  Next.js API Route (/api/generate)                       |
|                                                           |
|  1. Validate Origin header                                |
|  2. Read API key from Authorization header                |
|  3. Parse + validate DrillRequest body (Zod)              |
|  4. Build prompt (prompt-builder.ts)                      |
|  5. Call AI SDK generateText() + Output.object()          |
|  6. Validate response (response-parser.ts)                |
|  7. Return GeneratedSnippet or error                      |
+---------------------------+------------------------------+
                            |
                            v
                   Claude / OpenAI API
```

### Key Architecture Decisions (from Eng Review)

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | API route proxy (not direct browser calls) | Neither Claude nor OpenAI APIs support browser CORS |
| 2 | AI SDK (not custom provider abstraction) | `ai` + `@ai-sdk/anthropic` + `@ai-sdk/openai` provide provider switching, structured output, error handling. 3 fewer files. [Layer 1] |
| 3 | Per-request key passthrough (not httpOnly cookies) | Simpler. No CSRF risk with Authorization headers. Same trust model. Codex outside voice confirmed. |
| 4 | Single IDB store (not separate ai-drill-history) | AI drills stored in existing `custom-snippets` with `source: "ai"` discriminator. No DB version bump. No dual-write. |
| 5 | Cross-session aggregator (not modified analyzeWeakPatterns) | Existing function takes per-session error data. New function aggregates across sessions. DRY. |
| 6 | Persist error data in SessionRecord | Codex found SessionRecord only stores summaries, not raw errors. Must persist errors for aggregation. |
| 7 | Snippet bridge function | Codex found CustomSnippetRecord lacks Snippet type fields. `toSnippet()` converts at runtime. |
| 8 | Jaccard dedup scoped to AI drills only | Full corpus (5,838) comparison too slow (~500ms). AI-only scope is O(N) where N < 100. |
| 9 | Stdlib import allowlist | Reject third-party imports, allow standard library per language |
| 10 | Language-default weak patterns for cold start | When user has <3 sessions, use token-weights.ts defaults |

---

## 3. Data Model Changes

### 3.1 SessionRecord (modified - add error data)

```typescript
// lib/storage/session-history.ts

export type SessionRecord = {
    id: string;
    date: string;                    // ISO string
    snippetId: string;
    language: SupportedLanguage;
    lengthCategory: SnippetLength;
    difficulty: Difficulty;
    wpm: number;
    rawWpm: number;
    accuracy: number;
    elapsedMs: number;
    totalKeystrokes: number;
    correctKeystrokes: number;
    errorCount: number;
    history: HistoryEntry[];
    patternScore?: number;
    // NEW - for AI drill weak pattern aggregation
    errors?: ErrorEntry[];           // raw error positions from this session
    snippetContentLength?: number;   // needed to rebuild categoryMap
};
```

No migration needed. New fields are optional. Old sessions simply won't have
error data and will be skipped by the aggregator (falls back to language defaults).

### 3.2 CustomSnippetRecord (modified - add AI discriminator)

```typescript
// lib/storage/idb-store.ts

export type CustomSnippetRecord = {
    id: string;
    title: string;
    content: string;
    language: string;
    createdAt: string;               // ISO
    // NEW - discriminator
    source?: "user" | "ai";
    // NEW - AI-specific metadata (only when source === "ai")
    aiMetadata?: {
        provider: "claude" | "openai";
        model: string;
        reasoning: string;           // why this drill was generated
        focusAreas: string[];        // token categories targeted
        weakPatternsInput: string[]; // what was sent to the AI
        tokensUsed: number;
        costUsd: number;
        accepted: boolean;
        difficulty: Difficulty;
        lengthCategory: SnippetLength;
    };
};
```

No DB version bump. IndexedDB is schemaless. Existing records without
`source` are treated as `"user"`.

### 3.3 Snippet Type (reference - not modified)

```typescript
// lib/snippets.ts - EXISTING, DO NOT MODIFY

export type Snippet = {
    id: string;
    problemId: string;
    title: string;
    content: string;
    language: SupportedLanguage;
    lengthCategory: SnippetLength;
    difficulty: Difficulty;
    lines: number;
    sourceSlug?: string;
    frontendId?: number;
    tokens?: Token[];
};
```

AI drills must be converted to this type via `toSnippet()` bridge (see section 12).

### 3.4 Length Classification (reference - existing)

```typescript
// lib/snippets.ts - EXISTING

const LENGTH_THRESHOLDS = {
    short: 10,    // <= 10 lines
    medium: 30,   // <= 30 lines
} as const;
// > 30 lines = "long"
```

AI prompts MUST use these thresholds for line count ranges:
- short: 3-10 lines
- medium: 11-30 lines
- long: 31-60 lines (capped to keep drills manageable)

---

## 3.5 What's Ready for UI Implementation

The following infrastructure is **complete and ready to use** for UI implementation:

### Hooks Available
```typescript
// hooks/useAIDrills.ts
const {
  state,              // "idle" | "loading" | "preview" | "error"
  generateDrill,      // (language) => Promise<void>
  acceptDrill,      // () => Promise<Snippet | null>
  rejectDrill,      // () => void
  reset,            // () => void
  canGenerate,      // boolean - has API key and enabled
  remainingToday,   // number - daily quota remaining
} = useAIDrills(preferences);
```

### AI Key Config Component
```typescript
// components/AIKeyConfig.tsx
<AIKeyConfig />
```
- Manages Claude and OpenAI API keys in localStorage
- Provider selection (Claude preferred, OpenAI fallback)
- Daily limit configuration
- Connection testing
- Enable/disable toggle

### Preferences Context Extended
```typescript
const {
  preferences: {
    aiDrillsEnabled,
    aiProvider,
    aiMaxDrillsPerDay,
    aiDrillLengthPreference,
  },
  setAIDrillsEnabled,
  setAIProvider,
  setAIMaxDrillsPerDay,
  setAIDrillLengthPreference,
} = usePreferences();
```

### API Route Ready
- `POST /api/generate` - Proxies to Claude/OpenAI with user key
- Returns `GenerateApiResponse` with snippet, cost, tokens used
- Error codes: `NO_KEY`, `AUTH_ERROR`, `RATE_LIMITED`, `TIMEOUT`, `VALIDATION_FAILED`

---

## 4. New Files

### ✅ Implemented (Core Infrastructure)

```
lib/ai/
  ✅ types.ts                  # Shared types (DrillRequest, DrillResponse, etc.)
  ✅ skill-feed.ts             # Cross-session weak pattern aggregation
  ✅ prompt-builder.ts         # Prompt construction with stdlib allowlists
  ✅ response-parser.ts        # Validation pipeline (imports, delimiters, tokenizer, dedup)
  ✅ rate-limiter.ts           # Client-side 3-window rate limiting
  ✅ key-storage.ts            # localStorage key management
  ✅ snippet-bridge.ts         # toSnippet() conversion from CustomSnippetRecord

app/api/generate/
  ✅ route.ts                  # AI drill generation proxy

hooks/
  ✅ useAIDrills.ts            # React hook for generation UI state

components/
  ✅ AIKeyConfig.tsx           # API key config section (for PreferencesDrawer)
```

### ⏳ Pending (UI Components)

```
components/
  ⏳ AIDrillPanel.tsx          # Drill preview modal (Chakra Modal)
  ⏳ AILoadingSkeleton.tsx     # Code skeleton loader for loading state

tests/__tests__/ai/
  ⏳ skill-feed.test.ts
  ⏳ prompt-builder.test.ts
  ⏳ response-parser.test.ts
  ⏳ rate-limiter.test.ts
  ⏳ api-generate.test.ts
  ⏳ snippet-bridge.test.ts
  ⏳ preferences.test.ts
  ⏳ integration.test.ts

tests/e2e/
  ⏳ ai-drills.spec.ts
```

## 5. Modified Files

| File | Status | Change |
|------|--------|--------|
| `lib/storage/idb-store.ts` | ✅ | Add `source` + `aiMetadata` to `CustomSnippetRecord` type |
| `lib/storage/session-history.ts` | ✅ | Add `errors?` + `snippetContentLength?` to `SessionRecord` type |
| `lib/preferences-core.ts` | ✅ | Add AI preference defaults to `sanitizePreferences()` |
| `lib/preferences.tsx` | ✅ | Add AI preferences context setters |
| `hooks/useSessionLifecycle.ts` | ✅ | Persist `errors` array when finishing a session |
| `hooks/useSnippets.ts` | ✅ | Add path to include AI drills via `toSnippet()` bridge |
| `lib/export.ts` | ✅ | Extend export to include custom-snippets store |
| `components/session/SessionControlBar.tsx` | ⏳ | Add AI Drill button |
| `components/ResultCard.tsx` | ⏳ | Add AI badge (Tag + lightning bolt) |
| `components/PreferencesDrawer.tsx` | ⏳ | Add AIKeyConfig section |
| `components/ShortcutsDrawer.tsx` | ⏳ | Add Shift+A shortcut documentation |

---

## 6. API Route: /api/generate

```typescript
// app/api/generate/route.ts

import { generateText, Output } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { buildPrompt, drillResponseSchema } from "@/lib/ai/prompt-builder";
import { validateDrillResponse } from "@/lib/ai/response-parser";
import type { DrillRequest } from "@/lib/ai/types";

const drillRequestSchema = z.object({
    language: z.enum(["javascript", "python", "java", "cpp"]),
    difficulty: z.enum(["easy", "medium", "hard"]),
    lengthCategory: z.enum(["short", "medium", "long"]),
    weakPatterns: z.array(z.object({
        category: z.string(),
        errorCount: z.number(),
        totalTokens: z.number(),
        errorRate: z.number(),
        label: z.string(),
    })),
    targetTokenCategories: z.array(z.string()),
    recentDrillTitles: z.array(z.string()),
    userContext: z.object({
        estimatedWpm: z.number(),
        estimatedAccuracy: z.number(),
        sessionCount: z.number(),
    }),
});

export async function POST(request: Request) {
    // 1. Origin validation (CSRF protection)
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (origin && !origin.includes(host ?? "")) {
        return Response.json(
            { error: "Forbidden", code: "ORIGIN_MISMATCH" },
            { status: 403 }
        );
    }

    // 2. Read API key from Authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
        return Response.json(
            { error: "Configure your API key in settings", code: "NO_KEY" },
            { status: 401 }
        );
    }
    const apiKey = authHeader.slice(7);

    // 3. Parse + validate request body
    const body = await request.json();
    const parseResult = drillRequestSchema.safeParse(body);
    if (!parseResult.success) {
        return Response.json(
            { error: "Invalid request", details: parseResult.error.flatten() },
            { status: 400 }
        );
    }
    const drillRequest: DrillRequest = parseResult.data;

    // 4. Determine provider from key prefix
    const provider = apiKey.startsWith("sk-ant-")
        ? "claude"
        : "openai";

    // 5. Build prompt
    const { systemPrompt, userPrompt } = buildPrompt(drillRequest);

    // 6. Call AI SDK
    try {
        const model = provider === "claude"
            ? anthropic("claude-haiku-4-5-20251001", { apiKey })
            : openai("gpt-4o-mini", { apiKey });

        const result = await generateText({
            model,
            system: systemPrompt,
            prompt: userPrompt,
            output: Output.object({ schema: drillResponseSchema }),
            maxTokens: 2048,
            abortSignal: AbortSignal.timeout(30_000),
        });

        const drillResponse = result.object;

        // 7. Validate generated code
        const validation = validateDrillResponse(
            drillResponse,
            drillRequest,
        );
        if (!validation.valid) {
            return Response.json(
                {
                    error: "Generated code was invalid, try again",
                    code: "VALIDATION_FAILED",
                    reason: validation.reason,
                },
                { status: 422 }
            );
        }

        // 8. Return response with cost info
        return Response.json({
            snippet: drillResponse,
            provider,
            model: provider === "claude" ? "claude-haiku-4-5" : "gpt-4o-mini",
            tokensUsed: result.usage?.totalTokens ?? 0,
            costUsd: estimateCost(result.usage, provider),
        });
    } catch (error: unknown) {
        // Provider-specific error handling
        if (isAuthError(error)) {
            return Response.json(
                { error: "Check your API key", code: "AUTH_ERROR" },
                { status: 401 }
            );
        }
        if (isRateLimitError(error)) {
            return Response.json(
                { error: "Provider rate limited, try again shortly", code: "RATE_LIMITED" },
                { status: 429 }
            );
        }
        if (isTimeoutError(error)) {
            return Response.json(
                { error: "Generation timed out, try again", code: "TIMEOUT" },
                { status: 504 }
            );
        }
        return Response.json(
            { error: "Generation failed", code: "UNKNOWN" },
            { status: 500 }
        );
    }
}

function estimateCost(
    usage: { promptTokens?: number; completionTokens?: number } | undefined,
    provider: string
): number {
    if (!usage) return 0;
    const { promptTokens = 0, completionTokens = 0 } = usage;
    if (provider === "claude") {
        // Haiku: $1/M input, $5/M output
        return (promptTokens * 1 + completionTokens * 5) / 1_000_000;
    }
    // GPT-4o-mini: $0.15/M input, $0.6/M output
    return (promptTokens * 0.15 + completionTokens * 0.6) / 1_000_000;
}

function isAuthError(error: unknown): boolean {
    return error instanceof Error && (
        error.message.includes("401") ||
        error.message.includes("auth") ||
        error.message.includes("invalid_api_key")
    );
}

function isRateLimitError(error: unknown): boolean {
    return error instanceof Error && (
        error.message.includes("429") ||
        error.message.includes("rate_limit")
    );
}

function isTimeoutError(error: unknown): boolean {
    return error instanceof Error && error.name === "AbortError";
}
```

---

## 7. AI SDK Integration

### Dependencies to Add

```bash
bun add ai @ai-sdk/anthropic @ai-sdk/openai zod
```

- `ai` - Core AI SDK (generateText, Output.object)
- `@ai-sdk/anthropic` - Claude provider
- `@ai-sdk/openai` - OpenAI provider
- `zod` - Schema validation (used by AI SDK for structured output + request validation)

### Usage Pattern

The AI SDK runs **server-side only** (in the API route). No client-side bundle
impact. The `generateText()` call with `Output.object()` returns a typed,
schema-validated object. No manual JSON parsing needed.

```typescript
import { generateText, Output } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

const result = await generateText({
    model: anthropic("claude-haiku-4-5-20251001", { apiKey }),
    system: systemPrompt,
    prompt: userPrompt,
    output: Output.object({ schema: drillResponseSchema }),
    maxTokens: 2048,
    abortSignal: AbortSignal.timeout(30_000),
});

// result.object is typed as z.infer<typeof drillResponseSchema>
const drill = result.object;
```

---

## 8. Prompt Engineering

### System Prompt

```
You are a code drill generator for CodeSprint, a typing practice app for
programmers. You generate short, self-contained code snippets that users
will type to improve their coding speed and accuracy.

RULES:
1. Code MUST be syntactically valid {language}
2. Code MUST be self-contained
3. Standard library imports are ALLOWED: {stdlibAllowlist}
4. Third-party/external imports are FORBIDDEN
5. Code MUST NOT include comments explaining it's AI-generated
6. Code MUST be between {minLines} and {maxLines} lines
7. Code SHOULD emphasize these syntax patterns: {targetPatterns}
8. Code SHOULD be realistic, something a developer would actually write
9. Code SHOULD cover a single, coherent concept or algorithm
10. Code difficulty level: {difficulty}
11. Do NOT generate offensive, harmful, or inappropriate code
12. Do NOT generate code with security vulnerabilities as the pattern

Respond with valid JSON matching the provided schema.
```

### User Prompt Template

```
Generate a {difficulty} {language} coding drill.

Target length: {lengthCategory} ({minLines}-{maxLines} lines)

The user's weak areas (prioritize these syntax patterns):
{weakPatterns}

The user's current skill level:
- Estimated WPM: {estimatedWpm}
- Estimated Accuracy: {estimatedAccuracy}%
- Sessions completed: {sessionCount}

Recent drill titles to avoid repeating themes:
{recentDrillTitles}

Generate a drill that specifically exercises the user's weak patterns
while remaining at an appropriate difficulty level.
```

### Structured Output Schema (Zod)

```typescript
export const drillResponseSchema = z.object({
    title: z.string().describe("Short descriptive name, e.g. 'Binary Search Iterator'"),
    content: z.string().describe("The actual code to type"),
    explanation: z.string().describe("1-2 sentences about what the code does"),
    focusAreas: z.array(z.string()).describe("Token categories this drills"),
    reasoning: z.string().describe("Why this drill was chosen for this user"),
    estimatedDifficulty: z.enum(["easy", "medium", "hard"]),
});
```

### Stdlib Allowlists

```typescript
const STDLIB_ALLOWLISTS: Record<SupportedLanguage, string[]> = {
    python: [
        "collections", "itertools", "functools", "math", "typing",
        "dataclasses", "abc", "enum", "re", "json", "os", "sys",
        "pathlib", "datetime", "random", "string", "heapq", "bisect",
        "operator", "copy", "io", "contextlib",
    ],
    java: [
        "java.util", "java.io", "java.lang", "java.math",
        "java.util.stream", "java.util.function", "java.time",
        "java.util.concurrent", "java.nio",
    ],
    cpp: [
        "vector", "string", "map", "unordered_map", "set",
        "unordered_set", "algorithm", "numeric", "iostream",
        "sstream", "fstream", "memory", "functional", "utility",
        "queue", "stack", "deque", "array", "tuple", "optional",
        "variant", "any", "cassert", "cmath", "cstdio", "cstdlib",
        "climits", "iterator", "stdexcept", "type_traits",
    ],
    javascript: [],  // No imports allowed (everything is global)
};
```

### Line Count Ranges

```typescript
const LINE_RANGES: Record<SnippetLength, { min: number; max: number }> = {
    short:  { min: 3,  max: 10 },
    medium: { min: 11, max: 30 },
    long:   { min: 31, max: 60 },
};
```

These match the existing `LENGTH_THRESHOLDS` in `lib/snippets.ts`:
- short: <= 10 lines
- medium: <= 30 lines
- long: > 30 lines

---

## 9. Cross-Session Weak Pattern Aggregation

### The Problem

`analyzeWeakPatterns()` in `lib/pattern-analysis.ts` takes per-session raw data:

```typescript
analyzeWeakPatterns(
    errors: ErrorEntry[],    // raw error positions
    tokens: Token[],         // tokenized snippet
    contentLength: number,
    language: SupportedLanguage,
    topN: number = 3,
): WeakPattern[]
```

But `SessionRecord` historically only stored summaries (wpm, accuracy, patternScore).
The aggregator needs raw error data.

### The Solution

```typescript
// lib/ai/skill-feed.ts

import { analyzeWeakPatterns, type WeakPattern } from "@/lib/pattern-analysis";
import { tokenize } from "@/lib/tokenizer";
import { getWeights } from "@/lib/token-weights";
import type { SupportedLanguage, Difficulty, SnippetLength } from "@/lib/snippets";
import type { DrillRequest } from "./types";

// Language-default weak patterns (used for cold start)
// Derived from token-weights.ts: higher weight = harder = more likely weak spot
const LANGUAGE_DEFAULTS: Record<SupportedLanguage, WeakPattern[]> = {
    python: [
        { category: "keyword", errorCount: 0, totalTokens: 0, errorRate: 1.5, label: "Keywords" },
        { category: "operator", errorCount: 0, totalTokens: 0, errorRate: 1.5, label: "Operators" },
        { category: "whitespace", errorCount: 0, totalTokens: 0, errorRate: 0.7, label: "Whitespace (indentation)" },
    ],
    javascript: [
        { category: "keyword", errorCount: 0, totalTokens: 0, errorRate: 1.5, label: "Keywords" },
        { category: "operator", errorCount: 0, totalTokens: 0, errorRate: 1.5, label: "Operators" },
        { category: "delimiter", errorCount: 0, totalTokens: 0, errorRate: 1.2, label: "Delimiters" },
    ],
    java: [
        { category: "keyword", errorCount: 0, totalTokens: 0, errorRate: 1.5, label: "Keywords" },
        { category: "operator", errorCount: 0, totalTokens: 0, errorRate: 1.5, label: "Operators" },
        { category: "delimiter", errorCount: 0, totalTokens: 0, errorRate: 1.2, label: "Delimiters" },
    ],
    cpp: [
        { category: "operator", errorCount: 0, totalTokens: 0, errorRate: 1.6, label: "Operators" },
        { category: "keyword", errorCount: 0, totalTokens: 0, errorRate: 1.5, label: "Keywords" },
        { category: "delimiter", errorCount: 0, totalTokens: 0, errorRate: 1.3, label: "Delimiters" },
    ],
};

const MIN_SESSIONS_FOR_AGGREGATION = 3;

export async function aggregateWeakPatternsAcrossSessions(
    sessions: SessionRecord[],
    language: SupportedLanguage,
): Promise<WeakPattern[]> {
    // Filter to sessions that have error data
    const sessionsWithErrors = sessions.filter(
        (s) => s.errors && s.errors.length > 0 && s.snippetContentLength
    );

    if (sessionsWithErrors.length < MIN_SESSIONS_FOR_AGGREGATION) {
        return LANGUAGE_DEFAULTS[language];
    }

    // Aggregate weak patterns across sessions
    const categoryErrors = new Map<string, { total: number; errors: number }>();

    for (const session of sessionsWithErrors) {
        // Re-tokenize the snippet to get token data
        // (We need the snippet content - load it from the snippet store)
        const snippetContent = await getSnippetContent(session.snippetId);
        if (!snippetContent) continue;

        const tokens = tokenize(snippetContent, language);
        const patterns = analyzeWeakPatterns(
            session.errors!,
            tokens,
            session.snippetContentLength!,
            language,
        );

        for (const pattern of patterns) {
            const existing = categoryErrors.get(pattern.category) ?? { total: 0, errors: 0 };
            categoryErrors.set(pattern.category, {
                total: existing.total + pattern.totalTokens,
                errors: existing.errors + pattern.errorCount,
            });
        }
    }

    // Sort by error rate, return top 3
    const aggregated: WeakPattern[] = [];
    const weights = getWeights(language);

    for (const [category, data] of categoryErrors) {
        const rawRate = data.errors / Math.max(data.total, 1);
        const weight = weights[category as keyof typeof weights] ?? 1.0;
        aggregated.push({
            category: category as any,
            errorCount: data.errors,
            totalTokens: data.total,
            errorRate: rawRate * weight,
            label: CATEGORY_LABELS[category] ?? category,
        });
    }

    return aggregated
        .sort((a, b) => b.errorRate - a.errorRate)
        .slice(0, 3);
}

export async function buildDrillRequest(
    language: SupportedLanguage,
    preferences: PreferencesState,
): Promise<DrillRequest> {
    // 1. Get recent sessions with error data
    const sessions = await getSessionsAsync({ language, limit: 10 });
    const weakPatterns = await aggregateWeakPatternsAcrossSessions(sessions, language);

    // 2. Get adaptive difficulty state
    const skillModel = await getSkillModel(language);
    const difficulty: Difficulty = (skillModel?.currentDifficulty as Difficulty) ?? "easy";

    // 3. Determine length
    const lengthCategory: SnippetLength =
        preferences.aiDrillLengthPreference === "auto"
            ? inferLengthFromSkill(skillModel)
            : preferences.aiDrillLengthPreference;

    // 4. Get recent AI drill titles for dedup
    const recentDrills = await getRecentAIDrills(language, 10);

    return {
        language,
        difficulty,
        lengthCategory,
        weakPatterns,
        targetTokenCategories: weakPatterns.map((w) => w.category).slice(0, 3),
        recentDrillTitles: recentDrills.map((d) => d.title),
        userContext: {
            estimatedWpm: skillModel?.estimatedWpm ?? 40,
            estimatedAccuracy: skillModel?.estimatedAccuracy ?? 0.85,
            sessionCount: skillModel?.sessionCount ?? 0,
        },
    };
}
```

### Data Flow Diagram

```
+-------------------+     +--------------------+     +-------------------+
|  Pattern          |     |  Spaced            |     |  Adaptive         |
|  Analysis         |     |  Repetition        |     |  Difficulty       |
|  (scoring.ts)     |     |  (spaced-rep.ts)   |     |  (adaptive.ts)    |
|                   |     |                    |     |                   |
|  Per-session:     |     |  Not used for      |     |  Outputs:         |
|  - errors[]       |     |  drill generation  |     |  - currentDiff    |
|  - tokens         |     |  (drills feed      |     |  - estWpm         |
|  - categoryMap    |     |   INTO SR after)   |     |  - estAccuracy    |
+---------+---------+     +--------------------+     +---------+---------+
          |                                                    |
          v                                                    v
+---------+----------------------------------------------------+---------+
|                    Skill Model Feed                                     |
|                    (lib/ai/skill-feed.ts)                               |
|                                                                         |
|  aggregateWeakPatternsAcrossSessions():                                 |
|    - Load last 10 sessions with errors[]                                |
|    - Re-tokenize each snippet                                           |
|    - Call analyzeWeakPatterns() per session                              |
|    - Merge by category, weight by token-weights.ts                      |
|    - Return top 3 weakest categories                                    |
|    - If <3 sessions with data: return LANGUAGE_DEFAULTS                 |
|                                                                         |
|  buildDrillRequest():                                                   |
|    - Aggregated weak patterns                                           |
|    - Adaptive difficulty level                                          |
|    - Length preference                                                   |
|    - Recent drill titles (dedup)                                        |
|    -> DrillRequest                                                       |
+-----------------------------------+-------------------------------------+
                                    |
                                    v
                          +---------+---------+
                          |  Prompt Builder   |
                          |  (prompt-builder) |
                          +-------------------+
```

---

## 10. Response Validation Pipeline

Every AI response is untrusted. The pipeline runs 6 checks in order:

```
AI Response
    |
    v
[1. Schema validation] -- Zod parse of structured output
    |                      Fail -> 422 "Generated code was invalid"
    v
[2. Line count check]  -- Within +-20% of target range
    |                      Fail -> 422
    v
[3. Import check]      -- Only stdlib imports allowed (per-language allowlist)
    |                      Fail -> 422
    v
[4. Delimiter balance] -- Balanced braces {}, parens (), brackets []
    |                      Fail -> 422
    v
[5. Tokenizer dry-run] -- Run through existing tokenizer, check >0 scorable tokens
    |                      Fail -> 422
    v
[6. Jaccard dedup]     -- Compare against existing AI drills (source:"ai" only)
    |                      Similarity > 0.85 -> 422
    v
PASS -> Return to client
```

### Import Checker

```typescript
function checkImports(content: string, language: SupportedLanguage): {
    valid: boolean;
    violations: string[];
} {
    const violations: string[] = [];
    const allowlist = STDLIB_ALLOWLISTS[language];
    const lines = content.split("\n");

    for (const line of lines) {
        const trimmed = line.trim();

        if (language === "python") {
            const match = trimmed.match(/^(?:from\s+(\w+)|import\s+(\w+))/);
            if (match) {
                const module = match[1] ?? match[2];
                if (!allowlist.includes(module)) {
                    violations.push(module);
                }
            }
        } else if (language === "java") {
            const match = trimmed.match(/^import\s+([\w.]+)/);
            if (match) {
                const pkg = match[1];
                if (!allowlist.some((a) => pkg.startsWith(a))) {
                    violations.push(pkg);
                }
            }
        } else if (language === "cpp") {
            const match = trimmed.match(/^#include\s*<(\w+)>/);
            if (match) {
                if (!allowlist.includes(match[1])) {
                    violations.push(match[1]);
                }
            }
            // Reject #include "..." (local headers)
            if (trimmed.match(/^#include\s*"/)) {
                violations.push(trimmed);
            }
        } else if (language === "javascript") {
            // Reject all import/require statements
            if (trimmed.match(/^import\s/) || trimmed.match(/require\(/)) {
                violations.push(trimmed);
            }
        }
    }

    return { valid: violations.length === 0, violations };
}
```

### Jaccard Similarity (AI drills only)

```typescript
function jaccardSimilarity(tokensA: string[], tokensB: string[]): number {
    const setA = new Set(tokensA);
    const setB = new Set(tokensB);
    const intersection = new Set([...setA].filter((x) => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return intersection.size / union.size;
}

const DEDUP_THRESHOLD = 0.85;
```

---

## 11. Client-Side Rate Limiting

```typescript
// lib/ai/rate-limiter.ts

interface RateLimiterState {
    minuteTimestamps: number[];
    hourTimestamps: number[];
    dayTimestamps: number[];
    lastRequestMs: number;
}

const DEFAULTS = {
    maxPerMinute: 5,
    maxPerHour: 30,
    maxPerDay: 100,         // can be overridden via preferences
    cooldownMs: 2000,
};

const STORAGE_KEY = "codesprint-ai-rate-limit";
```

**Stored in localStorage.** Configurable via preferences (`aiMaxDrillsPerDay`).

**`getRemainingToday(): number`** - returns daily remaining for the UI badge.

**`checkRateLimit(): { allowed: boolean; reason?: string; retryAfterMs?: number }`**

Returns specific reasons:
- `"Wait {N} seconds"` (minute limit)
- `"Wait {N} minutes"` (hour limit)
- `"Daily limit reached (0 remaining). Try again tomorrow."` (day limit)
- `"Slow down"` (cooldown)

---

## 12. Snippet Bridge: AI Drill to Snippet Type

```typescript
// lib/ai/snippet-bridge.ts

import type { CustomSnippetRecord } from "@/lib/storage/idb-store";
import type { Snippet, SupportedLanguage, SnippetLength, Difficulty } from "@/lib/snippets";

export function toSnippet(record: CustomSnippetRecord): Snippet {
    const lines = record.content.split("\n").length;
    const lengthCategory: SnippetLength =
        record.aiMetadata?.lengthCategory ??
        (lines <= 10 ? "short" : lines <= 30 ? "medium" : "long");
    const difficulty: Difficulty =
        record.aiMetadata?.difficulty ?? "medium";

    return {
        id: record.id,
        problemId: `ai-drill-${record.id}`,    // stable, unique
        title: record.title,
        content: record.content,
        language: record.language as SupportedLanguage,
        lengthCategory,
        difficulty,
        lines,
    };
}
```

**Integration with useSnippets():** The hook gets a new code path that loads
AI drills from IDB (`source === "ai"`, `accepted === true`), converts them
via `toSnippet()`, and includes them alongside corpus snippets. They
participate in language filtering, length filtering, and SR recommendations
like any other snippet.

---

## 13. API Key Management (BYOK)

### Storage

Keys stored in `localStorage` under `"codesprint-ai-key-{provider}"`.

```typescript
// lib/ai/key-storage.ts

const KEY_PREFIX = "codesprint-ai-key-";

export function storeApiKey(provider: string, key: string): void {
    localStorage.setItem(`${KEY_PREFIX}${provider}`, key);
}

export function getApiKey(provider: string): string | null {
    return localStorage.getItem(`${KEY_PREFIX}${provider}`);
}

export function clearApiKey(provider: string): void {
    localStorage.removeItem(`${KEY_PREFIX}${provider}`);
}

export function hasApiKey(provider: string): boolean {
    return localStorage.getItem(`${KEY_PREFIX}${provider}`) !== null;
}
```

### Security Model

- Key is in localStorage (accessible to JavaScript, vulnerable to XSS)
- Sent per-request in `Authorization: Bearer <key>` header
- Server uses it once, never logs or persists it
- Origin header validated on server to prevent cross-origin abuse
- Keys are NEVER included in data export (export reads from IDB, keys are in localStorage)
- Users can clear keys with one action

**Acceptable tradeoff for BYOK:** Developers are used to this pattern (Cursor,
Continue, etc.). The alternative (httpOnly cookies) adds CSRF complexity without
removing the trust assumption. Revisit for Pro tier.

---

## 14. UI Components

### AIDrillPanel (Chakra Modal)

```
+-------------------------------------------------------+
|                                                       |
|  [Code preview - 60% of panel height]                 |
|  +-------------------------------------------------+  |
|  | def binary_search(arr, target):                 |  |
|  |     left, right = 0, len(arr) - 1               |  |
|  |     while left <= right:                         |  |
|  |         mid = (left + right) // 2                |  |
|  |         if arr[mid] == target:                   |  |
|  |             return mid                           |  |
|  |         elif arr[mid] < target:                  |  |
|  |             left = mid + 1                       |  |
|  |         else:                                    |  |
|  |             right = mid - 1                      |  |
|  |     return -1                                    |  |
|  +-------------------------------------------------+  |
|                                                       |
|  Targeting operators (your weakest at 78% accuracy)   |
|                                                       |
|  [Use This Drill]  [Generate Another]  [Cancel]       |
|                                                       |
|  Medium | 12 lines | ~$0.002 | haiku-4.5              |
+-------------------------------------------------------+
```

**Component:** Chakra `DialogRoot` with `size="lg"` (~512px)

**Visual hierarchy:**
1. Code preview (dominant, 60%+ height, `<pre>` with theme syntax highlighting)
2. One-line reasoning (secondary, muted text)
3. Action buttons (primary: "Use This Drill", secondary: "Generate Another", ghost: "Cancel")
4. Metadata footer (tertiary, small muted text)

**Code preview:** NOT Monaco Editor. A `<pre>` block with syntax highlighting
using the user's current theme tokens. Monaco is too heavyweight (~2MB) for
a read-only preview of 10-30 lines.

**Loading state:** Code skeleton loader. Pulsing lines that mimic code structure
(short-long-short-medium pattern with indentation). Not a generic spinner.

**Keyboard shortcuts:**
- `Shift+A` - Open panel (from SessionControlBar)
- `Enter` - Accept drill (primary action)
- `Shift+Enter` - Generate another
- `Escape` - Dismiss (Chakra Modal built-in)

**Responsive:** Hidden below 640px (desktop-only feature).

### AIKeyConfig (Preferences Drawer Section)

```
+-------------------------------------------------------+
|  AI Drills                                            |
|                                                       |
|  Provider: [Claude v]                                 |
|  API Key:  [**************3kF2]  [Clear]              |
|                                                       |
|  Daily limit: [20] drills/day                         |
|                                                       |
|  [Test Connection]  "Connected" (checkmark)           |
|                                                       |
|  Your API key is stored locally in your browser.      |
|  It is sent to our server per-request to proxy the    |
|  AI call, but is never stored or logged.              |
+-------------------------------------------------------+
```

**Component:** New section inside existing `PreferencesDrawer` body.

### AI Drill Button (SessionControlBar addition)

```
[JavaScript v] [Medium v] [Random v]  ...  [lightning AI Drill (17)]
```

- Chakra `Button` with `Badge` showing daily remaining count
- Only visible when `aiDrillsEnabled === true` AND `hasApiKey()`
- Hidden during active typing session (`phase === "running"`)
- Hidden below 640px
- Disabled with tooltip "Rate limit reached" when daily cap hit

### AI Badge (ResultCard addition)

- Chakra `Tag` with lightning bolt icon + "AI" text
- Positioned after existing difficulty/length tags
- Uses current theme's accent color
- Framer Motion `fadeIn` (0.3s, matches ResultScreen timing)

---

## 15. Interaction State Table

```
FEATURE                    | LOADING              | EMPTY / FIRST TIME          | ERROR                                          | SUCCESS              | DISABLED
---------------------------|----------------------|-----------------------------|------------------------------------------------|----------------------|---------------------------
AI Drill button            | Spinner + "Gen..."   | N/A                         | N/A                                            | Badge with count     | Grayed, tooltip "Config key"
AIDrillPanel (generation)  | Code skeleton loader | "First AI drill. Targeting  | Auth: "Check your API key" + link              | Code preview + meta  | Can't open (no key)
                           |                      |  [defaults] until we learn  | Timeout: "Timed out, try again" + retry        |                      |
                           |                      |  your style."               | Validation: "Code invalid, trying again..." x1 |                      |
                           |                      |                             | Rate limit: "Daily limit (0). Tomorrow." no btn|                      |
AIKeyConfig (test)         | "Testing..." spinner | Empty input field            | Red "Invalid key" or "Connection failed"       | Green check "Connected"| N/A
Rate limit badge           | N/A                  | Red/amber "(0)" + tooltip   | N/A                                            | Green badge "(17)"   | N/A
AI badge on ResultCard     | N/A                  | N/A                         | N/A                                            | Tag + lightning icon  | N/A
IDB write (save drill)     | N/A                  | N/A                         | Toast "Failed to save drill, try again"        | Silent success       | N/A
```

---

## 16. Design Specifications

### Theme Integration

- Code preview uses the user's current theme (gruvbox, catppuccin, etc.)
- All Chakra components use theme tokens (no hardcoded colors)
- The AI badge color follows the theme's accent
- The skeleton loader pulses use the theme's background/surface colors

### Component Patterns (matching existing codebase)

| New component | Matches existing | Chakra component |
|--------------|-----------------|-----------------|
| AIDrillPanel | AnalyticsModal, LeaderboardModal | `DialogRoot` size="lg" |
| AI Drill button | SessionControlBar pills | `Button` + `Badge` |
| AIKeyConfig | PreferencesDrawer sections | Section in `DrawerBody` |
| Error banners | N/A (new pattern) | `Alert` with status variants |
| Code preview | CodePanel (simpler) | `Box` fontFamily="mono" |
| Loading skeleton | N/A (new pattern) | Custom `Box` + keyframe |

### Accessibility

- Chakra Modal: ARIA roles, focus trap, Escape dismiss (built-in)
- AI Drill button: `aria-label="Generate AI drill"` + `aria-describedby` for count
- Code preview: `role="code"` on `<pre>` element
- Error banners: Chakra Alert handles ARIA live regions
- `Shift+A` shortcut documented in ShortcutsDrawer

### Responsive

- AI Drill button: `display={{ base: "none", md: "flex" }}` (hidden < 640px)
- AIDrillPanel: Desktop only (hidden if triggered on mobile somehow)
- AIKeyConfig: Follows existing drawer responsive behavior (full-width on mobile)

---

## 17. Preferences Extension

```typescript
// Added to PreferencesState defaults in lib/preferences-core.ts

const DEFAULTS = {
    // ... existing defaults ...
    aiDrillsEnabled: false,                         // default: false until key configured
    aiProvider: "claude" as "claude" | "openai",    // default: "claude"
    aiModel: "claude-haiku-4-5-20251001",           // default
    aiMaxDrillsPerDay: 20,                          // configurable daily cap
    aiAutoGenerate: false,                          // manual trigger only
    aiDrillLengthPreference: "auto" as SnippetLength | "auto",
};
```

`sanitizePreferences()` already handles unknown/missing fields with defaults.
New fields are simply added to the default object. Existing users get these
defaults on next load. No migration.

---

## 18. Export/Import Extension

Extend `lib/export.ts` to include custom snippets:

```typescript
// Current export only covers sessions.
// Add custom-snippets export:

export interface ExportData {
    version: number;
    exportedAt: string;
    sessions: SessionRecord[];
    customSnippets?: CustomSnippetRecord[];  // NEW
}
```

On import:
- Merge custom snippets by `id` (skip if already exists)
- Preserve `source` and `aiMetadata` fields
- AI drill mastery data in the `mastery` store references `snippetId`
  which is the custom snippet's `id`, so mastery survives import

---

## 19. Testing Strategy

### Test Framework

Vitest 4.0.18 with jsdom, `fake-indexeddb` 6.2.5, Playwright 1.58.2.

### Unit Tests

| File | Key assertions |
|------|---------------|
| `skill-feed.test.ts` | 0 sessions -> language defaults; 1-2 -> blended; 5+ -> pure data; no skill model -> safe defaults; sessions without errors -> skipped |
| `prompt-builder.test.ts` | Each language gets correct stdlib allowlist; empty weakPatterns -> defaults injected; line ranges match LENGTH_THRESHOLDS |
| `response-parser.test.ts` | Stdlib imports allowed, third-party rejected (per language); unbalanced delimiters rejected; tokenizer dry-run fail rejected; Jaccard > 0.85 rejected |
| `rate-limiter.test.ts` | All 3 windows enforced independently; daily remaining count accurate; localStorage cleared -> fresh limits |
| `api-generate.test.ts` | Missing Authorization -> 401; AI SDK auth error -> 401 distinct msg; validation failure -> 422; timeout -> 504; origin mismatch -> 403 |
| `snippet-bridge.test.ts` | CustomSnippetRecord with aiMetadata -> valid Snippet; missing aiMetadata -> derived fields; line count classification matches LENGTH_THRESHOLDS |
| `preferences.test.ts` | sanitizePreferences with no AI fields -> defaults applied; with valid AI fields -> preserved; with invalid -> corrected |

### Integration Tests

| File | Key assertions |
|------|---------------|
| `integration.test.ts` | Full flow: buildDrillRequest -> buildPrompt -> mocked AI SDK -> validateResponse -> store in IDB; AI snippet saved with source:"ai" + aiMetadata; filterable by source; works with existing tokenizer scoring; toSnippet() produces valid Snippet |

### E2E Tests (Playwright)

| Test | What it verifies |
|------|-----------------|
| "shows AI Drill button when key configured" | Button visible, badge count shown |
| "hides AI Drill button when feature disabled" | Button not in DOM |
| "API key config flow in preferences" | Enter -> test -> success indicator |
| "invalid API key shows error" | Enter -> test -> red error message |
| "generates drill and starts typing session" | Mock /api/generate, verify typing starts |
| "shows cost estimate and drill preview" | Code preview, metadata footer visible |
| "respects daily rate limit" | Mock rate limiter state, verify disabled |
| "AI badge shows on ResultCard" | Complete AI drill, verify badge |
| "new user with zero sessions gets defaults" | No prior sessions, drill still generates |
| "error states display correctly" | Mock various error responses |

E2E tests use Playwright route interception to mock `/api/generate` responses.

### Coverage Target: 80%+

---

## 20. Migration & Backwards Compatibility

| Change | Migration needed? | Risk |
|--------|-------------------|------|
| `errors?` on SessionRecord | No (optional field) | None. Old sessions lack error data, aggregator falls back to defaults. |
| `source?` + `aiMetadata?` on CustomSnippetRecord | No (optional fields, schemaless IDB) | None. Existing records have no `source` field, treated as "user". |
| New preferences fields | No (`sanitizePreferences` applies defaults) | None. |
| Export format extension | No (additive `customSnippets?` field) | Old exports can still be imported (field is optional). |
| New API routes | No (additive) | None. |
| New npm dependencies | No | Bundle size: AI SDK is server-side only. Zod is ~13KB. |

### Rollback Plan

If AI drills cause issues:
1. Set `aiDrillsEnabled: false` as default -> feature disappears from UI
2. AI snippets remain in `custom-snippets` store but are inert
3. No other stores, systems, or code paths are affected
4. Delete the API routes and AI lib files
5. Remove the 4 npm dependencies

---

## 21. Cost Analysis (BYOK)

| Model | Input cost | Output cost | Avg drill cost | 20 drills/day |
|-------|-----------|-------------|---------------|---------------|
| claude-haiku-4-5 | $1/M tokens | $5/M tokens | ~$0.002 | $0.04/day |
| claude-sonnet-4-6 | $3/M tokens | $15/M tokens | ~$0.008 | $0.16/day |
| gpt-4o-mini | $0.15/M tokens | $0.6/M tokens | ~$0.0003 | $0.006/day |

Monthly cost for a typical user (10-20 drills/day):
- Haiku: $0.60-1.20/month
- GPT-4o-mini: $0.09-0.18/month

---

## 22. Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| 1 | AI generates invalid/unscorable code | Medium | Medium | 6-layer validation pipeline; tokenizer dry-run; user can reject and regenerate |
| 2 | API key exposed via XSS | Low | High | localStorage is the accepted BYOK pattern; keys excluded from export; clear warning in UI; revisit for Pro tier |
| 3 | AI generates offensive code | Low | High | System prompt constraints; content filtering in response parser; user report mechanism (TODO) |
| 4 | Rate limit UX frustration | Medium | Low | Clear messaging; configurable limits; show remaining count badge |
| 5 | Generated code too easy/hard | Medium | Low | Adaptive difficulty feeds into prompt; user can generate another; length classification matches existing thresholds |
| 6 | Provider API changes | Low | Medium | AI SDK handles provider compatibility; version pinning |
| 7 | Cold start weak patterns aren't useful | Medium | Low | Language defaults are data-driven (from token-weights.ts); improves as sessions accumulate |
| 8 | IDB write failure loses AI drill | Low | Medium | try/catch with user-visible toast error |
| 9 | Export/import loses AI drills | Low | Medium | Extending export to include custom-snippets (building in Phase 1) |

---

## 23. Implementation Checklist

### ✅ Sprint 1: Data & Infrastructure (COMPLETED)

**Lane A: Error Data Persistence**
- [x] Add `errors?: ErrorEntry[]` to `SessionRecord` type
- [x] Add `snippetContentLength?: number` to `SessionRecord` type
- [x] Modify `useSessionLifecycle` to persist error data on session finish
- [ ] Test: sessions with error data can be loaded and filtered

**Lane B: AI Generation Pipeline**
- [x] `bun add ai @ai-sdk/anthropic @ai-sdk/openai zod`
- [x] Create `lib/ai/types.ts` (shared types)
- [x] Create `lib/ai/prompt-builder.ts` (prompt construction + stdlib allowlists)
- [x] Create `lib/ai/response-parser.ts` (validation pipeline)
- [x] Create `lib/ai/rate-limiter.ts` (client-side rate limiting)
- [x] Create `lib/ai/key-storage.ts` (localStorage key management)
- [x] Create `app/api/generate/route.ts` (API route proxy)
- [ ] Write unit tests for all above

### ✅ Sprint 2: Integration (COMPLETED)

- [x] Create `lib/ai/skill-feed.ts` (cross-session aggregation)
- [x] Create `lib/ai/snippet-bridge.ts` (toSnippet conversion)
- [x] Modify `CustomSnippetRecord` type (add source + aiMetadata)
- [x] Modify `useSnippets` to include AI drills
- [x] Extend `lib/export.ts` to include custom snippets
- [ ] Write integration tests (full flow with mocked AI SDK)

### 🚧 Sprint 3: UI (IN PROGRESS)

- [x] Add AI preferences to `PreferencesState` + `sanitizePreferences()`
- [x] Build `AIKeyConfig` component (preferences drawer section)
- [ ] Integrate `AIKeyConfig` into `PreferencesDrawer`
- [ ] Build `AIDrillPanel` component (Chakra Modal with code-first layout)
- [ ] Build code skeleton loader (loading state)
- [ ] Add AI Drill button to `SessionControlBar`
- [ ] Add AI badge to `ResultCard`
- [x] Implement `useAIDrills` hook
- [ ] Wire up to session lifecycle (AI drill -> typing session)
- [ ] Add `Shift+A` shortcut to `ShortcutsDrawer`
- [x] Add origin validation to `/api/generate`
- [ ] Add IDB error handling (try/catch with toast)

### ⏳ Sprint 4: Tests & Polish (PENDING)

- [ ] E2E tests with Playwright route interception
- [ ] All 4 error states tested (auth, timeout, validation, rate limit)
- [ ] Cold start path tested (zero sessions)
- [ ] Accessibility review (keyboard nav, screen reader)
- [ ] Hide AI features on mobile (<640px)
- [ ] Final regression testing (existing features unaffected)
- [ ] Release v2.1.0

---

## 24. Parallelization Strategy

| Step | Modules touched | Depends on |
|------|----------------|------------|
| A. Error data persistence | `lib/storage/`, `hooks/useSessionLifecycle` | -- |
| B. AI generation pipeline | `lib/ai/`, `app/api/` | -- |
| C. Snippet bridge + integration | `hooks/useSnippets`, `lib/ai/skill-feed`, `lib/export` | A |
| D. UI components | `components/`, `hooks/useAIDrills` | B, C |
| E. Tests + polish | `__tests__/`, `e2e/` | A, B, C, D |

```
Time --->

Lane A: [Error data persistence]----------+
                                           |
Lane B: [AI generation pipeline]-----------|---+
                                           |   |
Lane C:              [Snippet integration]-+   |
                                               |
Lane D:                    [UI components]-----+
                                               |
Lane E:                         [Tests + polish]
```

**Launch A + B in parallel.** Once A completes, start C. Once B + C complete,
start D. E runs after everything.

**Conflict flag:** Lanes A and C both touch `hooks/` directory. Potential merge
conflict in `useSnippets`. Coordinate.

---

## 25. NOT in Scope (Phase 1)

| Deferred item | Rationale |
|---------------|-----------|
| Pro tier (hosted API key, auth, Stripe billing) | Separate product. Separate spec. |
| Cloud sync | Requires backend infrastructure. Phase 3. |
| OpenAI as default provider | AI SDK makes adding providers trivial. Claude-only default. |
| Pre-generation batching | Optimization. Ship synchronous first. |
| Server-side drill caching (Redis) | Pro tier infrastructure. |
| Global leaderboards / multiplayer | Backend features. |
| Tree-sitter AST validation | Follow-up for code quality improvement. |
| AI Drill History analytics tab | Can use existing analytics. Defer dedicated tab. |
| User-reported bad snippet mechanism | Phase 2 quality feedback loop. |
| Mobile AI drill support | Desktop-only (keyboard required). |
| DESIGN.md creation | Separate workflow (/design-consultation). |

---

## 26. Open TODOs

### In TODOS.md

1. **Define Length Category Mapping** - Explicit line count ranges per
   `lengthCategory` for AI drills matching `lib/snippets.ts` classification.
   (From eng review, Codex finding #5.)

---

## 27. Review History

### Engineering Review (2026-03-27)

- **Status:** CLEARED
- **Issues found:** 14 (all resolved)
- **Critical gaps (from Codex outside voice):**
  - SessionRecord doesn't persist error data (resolved: persist going forward)
  - CustomSnippetRecord doesn't map to Snippet type (resolved: bridge function)
  - httpOnly cookies overcomplicated for Phase 1 (resolved: per-request passthrough)
- **Scope:** Phase 1 as written, Phases 2+3 deferred

### Design Review (2026-03-28)

- **Status:** CLEARED
- **Score:** 4/10 -> 8/10
- **Decisions made:** 6
  - Code-first hierarchy in drill panel (60% code preview)
  - Code skeleton loader for loading state
  - Chakra Modal (size="lg") for AIDrillPanel
  - User's current theme for code preview
  - Hidden on mobile (<640px)
  - Keyboard shortcuts: Shift+A, Enter, Shift+Enter, Escape

### Outside Voice (Codex, 2026-03-27)

- 10 findings, 3 critical (all resolved in eng review)
- Key insight: "The order is backwards. First decide what data must be
  persisted and how AI drills fit the existing snippet model."

---

## 28. Next Steps for UI Implementation

**Status:** Core infrastructure is complete and building successfully. The following UI components need to be implemented:

### Remaining UI Work (Sprint 3):

1. **Integrate AIKeyConfig into PreferencesDrawer**
   - Import and add `<AIKeyConfig />` section to the drawer
   - Add heading "AI Drills" above the component

2. **Build AIDrillPanel component**
   - Chakra Modal (size="lg", ~512px)
   - Code preview (60% of panel height, use `<pre>` not Monaco)
   - One-line reasoning display
   - Action buttons: "Use This Drill" (primary), "Generate Another" (secondary), "Cancel" (ghost)
   - Metadata footer: difficulty, lines, cost, model
   - Loading state: code skeleton loader (pulsing lines)
   - Keyboard shortcuts: Enter (accept), Shift+Enter (regenerate), Escape (cancel)
   - Hidden on mobile (<640px)

3. **Add AI Drill button to SessionControlBar**
   - Button with lightning bolt icon + "AI Drill" text
   - Badge showing daily remaining count
   - Only visible when `aiDrillsEnabled === true` AND `hasApiKey()`
   - Hidden during active typing session
   - Disabled with tooltip when rate limit hit

4. **Add AI badge to ResultCard**
   - Chakra Tag with lightning bolt icon + "AI" text
   - Positioned after difficulty/length tags
   - Framer Motion fadeIn (0.3s)

5. **Add Shift+A shortcut to ShortcutsDrawer**
   - Document in keyboard shortcuts list
   - Only when AI drills enabled

6. **Wire up to session lifecycle**
   - When drill accepted, load it as current snippet
   - Trigger engine reset and start typing session

### Ready to Use APIs:

```typescript
// hooks/useAIDrills.ts
const {
  state,              // "idle" | "loading" | "preview" | "error"
  generateDrill,      // (language) => Promise<void>
  acceptDrill,        // () => Promise<Snippet | null>
  rejectDrill,        // () => void
  reset,              // () => void
  canGenerate,        // boolean - has API key and enabled
  remainingToday,     // number - daily quota remaining
} = useAIDrills(preferences);

// components/AIKeyConfig.tsx
<AIKeyConfig />
```

### Build Status:
- ✅ `npm run build` - SUCCESS
- ✅ `npm run lint` - Only warnings (no errors in new code)
