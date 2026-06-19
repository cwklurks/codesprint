# CodeSprint Quality & UX Improvements Specification

## Overview

This spec covers P0 (critical) and P1 (high-priority) improvements for CodeSprint, addressing code quality, type safety, user experience, and accessibility.

**Tech stack notes:**
- Chakra UI **v3.27.1** (not v2 - `VStack` removed, use `Stack` or `Flex`)
- `monaco-vim` v0.4.2 (no TypeScript declarations shipped)
- Vitest for unit tests, Playwright for e2e (already properly separated)
- Framer Motion for animations (existing `AchievementToast.tsx` pattern)

---

## P0: Critical Improvements

### P0-1: ESLint Warning Fixes

**Files affected:**
- `components/analytics/AnalyticsDashboard.tsx` (line 425: `_props` unused parameter)
- `hooks/useAIDrills.ts` (line 164: `_error` unused in catch block)
- `lib/__tests__/leaderboard.test.ts` (line 15: `saveScore`, `clearLeaderboard` imported but unused)

**Action:** Remove unused imports in the test file. The `_props` and `_error` are already underscore-prefixed - verify ESLint config flags these; if so, either consume them or remove the parameter/binding.

---

### P0-2: Error Boundary Component

**New file:** `components/ErrorBoundary.tsx`

```typescript
// components/ErrorBoundary.tsx
"use client";

import { Component, ReactNode } from "react";
import { Box, Button, Heading, Text, Stack } from "@chakra-ui/react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Box p={8} textAlign="center">
          <Stack gap={4} align="center">
            <Heading size="md">Something went wrong</Heading>
            <Text color="fg.muted">{this.state.error?.message}</Text>
            <Button onClick={this.handleReset}>Try Again</Button>
          </Stack>
        </Box>
      );
    }

    return this.props.children;
  }
}
```

**Usage:** Wrap `<TypingSession />` in `app/page.tsx`:

```typescript
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function HomePage() {
    return (
        <Box w="100%">
            <ErrorBoundary>
                <TypingSession />
            </ErrorBoundary>
        </Box>
    );
}
```

Note: `CodePanel` is dynamically imported inside `TypingSession` via `next/dynamic`, so wrapping `TypingSession` covers it transitively.

---

### P0-3: Extract Magic Numbers to Constants

**New file:** `lib/constants.ts`

```typescript
// lib/constants.ts

// Timing constants (in milliseconds)
export const TIMING = {
  CARET_ERROR_FLASH_MS: 600,
  METRICS_PUBLISH_INTERVAL_MS: 1500,
  COUNTDOWN_DURATION_MS: 3000,
  TOAST_DURATION_MS: 3000,
  MS_IN_MINUTE: 60000,
} as const;

// Editor constants
export const EDITOR = {
  LINE_HEIGHT_MULTIPLIER: 1.55,
  HEIGHT_BUFFER_LINES: 4,
  MAX_WRONG_CHARS_TRACKED: 200,
  MAX_EDITOR_HEIGHT_PX: 720,
  MIN_EDITOR_HEIGHT_PX: 320,
  FONT_SIZE_DEFAULT: 14,
  FONT_SIZE_MIN: 10,
  FONT_SIZE_MAX: 24,
} as const;

// CSS class names (single source of truth)
export const CSS_CLASSES = {
  CARET: "cs-caret",
  CARET_HIDDEN: "cs-caret-hidden",
  CARET_ACTIVE: "cs-caret-active",
  CARET_ERROR: "cs-caret-error",
  COMPLETE_CHAR: "cs-complete",
  WRONG_CHAR: "cs-wrong",
} as const;
```

**Files to update with these constants:**
- `components/CodePanel.tsx` - uses `1.55` (line 25), `720`/`320` (line 58), `"cs-caret"`, `"cs-caret-hidden"`, `"cs-complete"`, `"cs-wrong"` as raw strings
- `hooks/useTypingEngine.ts` - uses `60000` (line 111), `200` (line 406)

---

### P0-4: Type Safety - Vim Mode Ref

**New file (required):** `types/monaco-vim.d.ts`

`monaco-vim` ships no TypeScript declarations, so a manual declaration is needed:

```typescript
// types/monaco-vim.d.ts
declare module "monaco-vim" {
  import type * as Monaco from "monaco-editor";

  interface VimMode {
    dispose(): void;
  }

  export function initVimMode(
    editor: Monaco.editor.IStandaloneCodeEditor,
    statusBarNode?: HTMLElement | null,
  ): VimMode;
}
```

**File:** `components/CodePanel.tsx`

```typescript
// Before (lines 51-52)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const vimModeRef = useRef<any>(null);

// After
import type { VimMode } from "monaco-vim";
const vimModeRef = useRef<VimMode | null>(null);
```

Remove the `eslint-disable` comment once the type is applied.

---

### ~~P0-5: Null Guards for DOM Operations~~ REMOVED

Both usages of `editor.getDomNode()` in `CodePanel.tsx` already have proper null guards (lines 95-96 and line 237). No action needed.

---

## P1: High-Priority Improvements

### P1-1: Toast Notification System

Build on the existing `AchievementToast.tsx` framer-motion pattern rather than introducing a new Chakra snippet dependency.

**New file:** `components/Toast.tsx`

```typescript
// components/Toast.tsx
"use client";

import { createContext, useContext, useCallback, useState, ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Box, Flex, Text } from "@chakra-ui/react";

type ToastType = "success" | "error" | "info" | "warning";

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (options: Omit<ToastItem, "id">) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

const TYPE_COLORS: Record<ToastType, string> = {
  success: "#48bb78",
  error: "#f56565",
  info: "#4299e1",
  warning: "#d69e2e",
};

const AUTO_DISMISS_MS = 3000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  let nextId = 0;

  const showToast = useCallback((options: Omit<ToastItem, "id">) => {
    const id = ++nextId;
    setToasts((prev) => [...prev, { ...options, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, AUTO_DISMISS_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <Box position="fixed" bottom={6} right={6} zIndex={50} display="flex" flexDirection="column-reverse" gap={3}>
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 100, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <Flex
                align="center"
                gap={3}
                px={4}
                py={3}
                bg="var(--panel)"
                border="1px solid var(--border)"
                borderLeft={`3px solid ${TYPE_COLORS[toast.type]}`}
                borderRadius="lg"
                backdropFilter="blur(12px)"
                boxShadow="var(--shadow)"
                minW="280px"
                maxW="360px"
              >
                <Box flex={1} minW={0}>
                  <Text fontWeight={700} fontSize="sm" color="var(--text)" truncate>
                    {toast.title}
                  </Text>
                  {toast.description && (
                    <Text fontSize="xs" color="var(--text-subtle)" truncate>
                      {toast.description}
                    </Text>
                  )}
                </Box>
              </Flex>
            </motion.div>
          ))}
        </AnimatePresence>
      </Box>
    </ToastContext.Provider>
  );
}
```

**Usage locations:**
- On preferences save: `showToast({ title: "Preferences saved", type: "success" })`
- On snippet load failure: `showToast({ title: "Snippet load failed", description: "Retrying...", type: "error" })`
- On AI drill generation: `showToast({ title: "Drill generated", type: "success" })`

**Note:** Do NOT add a toast on "R" key reset - it's a rapid-retry shortcut that users spam; a toast per press would be disruptive.

---

### P1-2: Mobile Responsiveness (Targeted)

The project already uses Chakra responsive props (`base:`, `md:`) in `AppShell.tsx`, `CodePanel.tsx`, `ResultCard.tsx`, etc. The remaining gap is `LiveStats.tsx` which uses a fixed `minW="260px"`.

**File:** `components/LiveStats.tsx`

```typescript
// Change fixed minW to responsive
<Box
    borderRadius="16px"
    border="1px solid var(--border)"
    bg="var(--panel-glass)"
    backdropFilter="blur(12px)"
    px={{ base: 4, md: 6 }}
    py={{ base: 3, md: 4 }}
    minW={{ base: "auto", md: "260px" }}
    w={{ base: "100%", md: "auto" }}
    color="var(--text)"
>
```

Also ensure touch targets: verify all interactive elements (buttons, links) have min 44px hit areas.

---

### P1-3: Accessibility - aria-live for LiveStats

**File:** `components/LiveStats.tsx`

```typescript
// Add to WPM display (line 28)
<Text
  fontSize="2xl"
  fontWeight={700}
  aria-live="polite"
  aria-atomic="true"
  aria-label={`Words per minute: ${wpm == null ? "not started" : Math.max(0, Math.round(wpm))}`}
>
  {wpm == null ? "\u2014" : Math.max(0, Math.round(wpm))}
</Text>

// Add to Accuracy display (line 31)
<Text
  fontSize="2xl"
  fontWeight={700}
  aria-live="polite"
  aria-atomic="true"
  aria-label={`Accuracy: ${(accuracy * 100).toFixed(0)} percent`}
>
  {(accuracy * 100).toFixed(0)}%
</Text>
```

---

### ~~P1-4: e2e Test Configuration Fix~~ REMOVED

`vitest.config.ts` already excludes `e2e/` from its test paths, and `playwright.config.ts` targets `./e2e`. The file `e2e/typing-session.spec.ts` already exists with tests. There is no conflict.

---

### P1-4: CSS Class Constants (renumbered from P1-5)

**Update:** Use constants from P0-3 in `CodePanel.tsx`

```typescript
// Before
caretNode.className = "cs-caret cs-caret-hidden";
caretNode.classList.add("cs-caret-hidden");
caretNode.classList.remove("cs-caret-hidden");
options: { inlineClassName: "cs-complete" }
options: { inlineClassName: "cs-wrong" }

// After
import { CSS_CLASSES } from "@/lib/constants";
caretNode.className = `${CSS_CLASSES.CARET} ${CSS_CLASSES.CARET_HIDDEN}`;
caretNode.classList.add(CSS_CLASSES.CARET_HIDDEN);
caretNode.classList.remove(CSS_CLASSES.CARET_HIDDEN);
options: { inlineClassName: CSS_CLASSES.COMPLETE_CHAR }
options: { inlineClassName: CSS_CLASSES.WRONG_CHAR }
```

---

## Implementation Order

1. **P0-1** - ESLint fixes (quick win, 5 min)
2. **P0-3** - Constants file (foundational for P1-4)
3. **P0-2** - Error Boundary
4. **P0-4** - Type declarations + Vim ref type safety
5. **P1-1** - Toast system (framer-motion based)
6. **P1-2** - LiveStats mobile responsiveness
7. **P1-3** - Accessibility aria-live attributes
8. **P1-4** - CSS class constants (depends on P0-3)

---

## Acceptance Criteria

| ID | Criterion | Test |
|----|-----------|------|
| AC-1 | `bun run lint` passes with 0 errors, 0 warnings | Run lint |
| AC-2 | Error boundary catches Monaco crash gracefully | Manual test: throw in TypingSession |
| AC-3 | No `any` types in CodePanel vim ref | `grep -r "useRef<any>" components/` returns empty |
| AC-4 | Toast appears on preferences save | Manual test |
| AC-5 | LiveStats readable at 375px width | Browser dev tools mobile emulation |
| AC-6 | Screen reader announces WPM changes | VoiceOver / axe audit |
| AC-7 | All unit tests pass | `bun test --run` |
| AC-8 | No new TypeScript errors | `bun run build` |
| AC-9 | No raw CSS class strings in CodePanel | `grep -n '"cs-' components/CodePanel.tsx` returns empty |

---

## Files Summary

**New files:**
- `components/ErrorBoundary.tsx`
- `components/Toast.tsx`
- `lib/constants.ts`
- `types/monaco-vim.d.ts`

**Modified files:**
- `components/analytics/AnalyticsDashboard.tsx` (P0-1: unused param)
- `hooks/useAIDrills.ts` (P0-1: unused catch binding)
- `lib/__tests__/leaderboard.test.ts` (P0-1: unused imports)
- `components/CodePanel.tsx` (P0-3: constants, P0-4: vim ref type, P1-4: CSS class constants)
- `hooks/useTypingEngine.ts` (P0-3: magic numbers)
- `components/LiveStats.tsx` (P1-2: responsive, P1-3: accessibility)
- `app/page.tsx` (P0-2: ErrorBoundary wrapper)
