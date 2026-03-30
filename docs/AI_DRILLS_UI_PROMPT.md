# CodeSprint AI Drills - UI Implementation Task

## Context

You are implementing the UI components for the AI Drills feature in CodeSprint. The infrastructure is complete and ready to use. You need to build the remaining UI components and integrate them into the existing session flow.

## What's Already Implemented

### Core Infrastructure (Ready to Use)
```
lib/ai/
  ✅ types.ts              - Shared types (DrillRequest, DrillResponse, etc.)
  ✅ skill-feed.ts         - Cross-session weak pattern aggregation
  ✅ prompt-builder.ts     - Prompt construction with stdlib allowlists
  ✅ response-parser.ts    - Validation pipeline
  ✅ rate-limiter.ts       - Client-side 3-window rate limiting
  ✅ key-storage.ts        - localStorage key management
  ✅ snippet-bridge.ts     - toSnippet() conversion

app/api/generate/route.ts   - API route proxy (POST /api/generate)

hooks/
  ✅ useAIDrills.ts        - React hook for generation UI state

components/
  ✅ AIKeyConfig.tsx       - API key config section

lib/
  ✅ preferences.tsx       - Extended with AI preferences
  ✅ export.ts            - Extended with custom snippets
```

### Available APIs for UI Implementation

```typescript
// hooks/useAIDrills.ts
const {
  state,              // "idle" | "loading" | "preview" | "error"
  generateDrill,    // (language: SupportedLanguage) => Promise<void>
  acceptDrill,      // () => Promise<Snippet | null>
  rejectDrill,      // () => void
  reset,            // () => void
  canGenerate,      // boolean - has API key and enabled
  remainingToday,   // number - daily quota remaining
} = useAIDrills(preferences);

// lib/ai/key-storage.ts
import { hasApiKey, getActiveProvider } from "@/lib/ai/key-storage";

// lib/ai/rate-limiter.ts
import { checkRateLimit, getRemainingToday } from "@/lib/ai/rate-limiter";
```

### AI Preferences (in usePreferences)
```typescript
const {
  preferences: {
    aiDrillsEnabled,
    aiProvider,
    aiMaxDrillsPerDay,
    aiDrillLengthPreference, // "auto" | "short" | "medium" | "long"
  },
  setAIDrillsEnabled,
  setAIProvider,
  setAIMaxDrillsPerDay,
  setAIAutoGenerate,
  setAIDrillLengthPreference,
} = usePreferences();
```

## UI Components to Implement

### 1. Integrate AIKeyConfig into PreferencesDrawer

**File:** `components/PreferencesDrawer.tsx`

**Requirements:**
- Import `AIKeyConfig` from `@/components/AIKeyConfig`
- Add a new section "AI Drills" with the `<AIKeyConfig />` component
- Place it in the drawer body, after the "Adaptive Difficulty" section
- Use Chakra UI styling consistent with other preference sections

**Code Pattern:**
```tsx
import { AIKeyConfig } from "@/components/AIKeyConfig";

// In the drawer body:
<Box>
  <Text fontSize="sm" fontWeight={600} mb={3}>
    AI Drills
  </Text>
  <AIKeyConfig />
</Box>
```

---

### 2. Build AIDrillPanel Component

**File:** `components/AIDrillPanel.tsx` (new file)

**Requirements:**
- Chakra Modal component (`size="lg"`, ~512px width)
- **Layout (60% code):**
  - Code preview using `<pre>` element (NOT Monaco - per design spec)
  - Show user's current theme colors for code
  - Syntax highlighting not required for MVP
- **Content:**
  - Title: Drill title from `drill.title`
  - Explanation: One-line reasoning from `drill.explanation`
  - Focus areas: List of token categories this drill targets
- **Footer metadata:**
  - Difficulty badge (easy/medium/hard)
  - Line count
  - Cost (e.g., "~$0.002")
  - Model name (e.g., "claude-3-haiku")
- **Action buttons:**
  - Primary: "Use This Drill" (Enter key)
  - Secondary: "Generate Another" (Shift+Enter)
  - Ghost: "Cancel" (Escape key)
- **Loading state:**
  - Code skeleton loader (5-7 pulsing lines)
  - Disable buttons during generation
  - Show spinner in button
- **Error state:**
  - Error message display
  - "Try Again" button
  - Clear error on retry
- **Keyboard shortcuts:**
  - `Enter` - Accept drill
  - `Shift+Enter` - Regenerate
  - `Escape` - Close modal
- **Mobile:** Hide entire feature on screens <640px

**Props Interface:**
```typescript
interface AIDrillPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: (snippet: Snippet) => void;
  language: SupportedLanguage;
}
```

**Hook Usage:**
```typescript
const ai = useAIDrills(preferences);

// On mount/open:
useEffect(() => {
  if (isOpen && ai.state.status === "idle") {
    ai.generateDrill(language);
  }
}, [isOpen, language]);

// On accept:
const handleAccept = async () => {
  const snippet = await ai.acceptDrill();
  if (snippet) {
    onAccept(snippet);
    onClose();
  }
};
```

---

### 3. Add AI Drill Button to SessionControlBar

**File:** `components/session/SessionControlBar.tsx`

**Requirements:**
- Add button with lightning bolt icon (`<LuZap />` from lucide-react) + "AI" text
- Show badge with remaining count: `{remainingToday}`
- **Visibility conditions:**
  - Only when `preferences.aiDrillsEnabled === true`
  - Only when `hasApiKey()` returns true (key configured)
  - Hidden during active typing session (`phase === "running"` or `phase === "countdown"`)
- **Disabled state:**
  - When rate limited (check with `checkRateLimit()`)
  - Show tooltip: "Daily limit reached" or "Slow down"
- **Position:** Next to the problem navigation buttons
- **On click:** Open `AIDrillPanel` modal

**Code Pattern:**
```tsx
import { LuZap } from "react-icons/lu";
import { hasApiKey } from "@/lib/ai/key-storage";
import { checkRateLimit } from "@/lib/ai/rate-limiter";

// In the component:
const showAIDrill = preferences.aiDrillsEnabled && hasApiKey() && 
  phase !== "running" && phase !== "countdown";

const rateLimit = checkRateLimit(preferences.aiMaxDrillsPerDay);

// Button:
{showAIDrill && (
  <Tooltip content={!rateLimit.allowed ? rateLimit.reason : "Generate AI drill (Shift+A)"}>
    <Button
      onClick={() => setIsDrillPanelOpen(true)}
      disabled={!rateLimit.allowed}
      leftIcon={<LuZap />}
    >
      AI
      <Badge ml={1} size="sm">{ai.remainingToday}</Badge>
    </Button>
  </Tooltip>
)}
```

---

### 4. Add AI Badge to ResultCard

**File:** `components/ResultCard.tsx` (or appropriate result display component)

**Requirements:**
- Display when session completed an AI-generated drill
- Chakra Tag with lightning bolt icon + "AI" text
- Color scheme: use `accent` theme color
- Position: After difficulty/length tags, before "Next Problem" button
- Framer Motion fadeIn animation (0.3s)
- Only show if `snippet.id.startsWith("ai-drill-")` or check `source === "ai"`

**Code Pattern:**
```tsx
import { Tag } from "@chakra-ui/react";
import { LuZap } from "react-icons/lu";
import { motion } from "framer-motion";

// In result display:
{isAIDrill && (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
    <Tag colorScheme="accent" size="sm">
      <LuZap style={{ marginRight: "4px" }} />
      AI
    </Tag>
  </motion.div>
)}
```

---

### 5. Add Shift+A Shortcut to ShortcutsDrawer

**File:** `components/ShortcutsDrawer.tsx`

**Requirements:**
- Add to keyboard shortcuts list
- Only show when `aiDrillsEnabled === true`
- Label: "Generate AI drill"
- Key: "Shift + A"

**Code Pattern:**
```tsx
// In shortcuts list:
{preferences.aiDrillsEnabled && hasApiKey() && (
  <HStack justify="space-between">
    <Text>Generate AI drill</Text>
    <Kbd>Shift + A</Kbd>
  </HStack>
)}
```

---

### 6. Wire Up to Session Lifecycle

**File:** `components/TypingSession.tsx` (or main orchestrator)

**Requirements:**
- Import and use `AIDrillPanel` 
- When drill is accepted, load it as current snippet
- Trigger engine reset
- Auto-start the typing session

**Code Pattern:**
```tsx
const [isDrillPanelOpen, setIsDrillPanelOpen] = useState(false);

const handleDrillAccept = (snippet: Snippet) => {
  // Load the AI drill as current snippet
  controls.setSnippet(snippet); // or equivalent method
  
  // Reset and start
  engine.reset();
  engine.start();
};

// In JSX:
<AIDrillPanel
  isOpen={isDrillPanelOpen}
  onClose={() => setIsDrillPanelOpen(false)}
  onAccept={handleDrillAccept}
  language={controls.language}
/>
```

---

### 7. (Optional) Code Skeleton Loader Component

**File:** `components/AILoadingSkeleton.tsx` (new file)

**Requirements:**
- 5-7 horizontal pulsing lines
- Width varies to look like code (e.g., 100%, 80%, 60%, 90%, 70%)
- Use Chakra's Skeleton component
- Match code editor background color

**Code Pattern:**
```tsx
import { Skeleton, VStack } from "@chakra-ui/react";

export function AILoadingSkeleton() {
  const widths = ["100%", "85%", "60%", "90%", "75%", "40%"];
  
  return (
    <VStack gap={2} align="stretch">
      {widths.map((width, i) => (
        <Skeleton key={i} height="1.5em" width={width} />
      ))}
    </VStack>
  );
}
```

---

## Design Specifications

### Layout Hierarchy (AIDrillPanel)
```
Modal (size="lg", centered)
├── ModalHeader
│   └── Title + Close button
├── ModalBody (flex, flexDirection="column", height="70vh")
│   ├── Explanation text (10%)
│   ├── Code preview <pre> (60%, overflow="auto")
│   └── Focus areas tags (5%)
├── ModalFooter
│   ├── Metadata (difficulty, lines, cost, model)
│   └── Action buttons (Use This Drill, Generate Another, Cancel)
```

### Colors
- Use CSS variables from theme: `var(--bg)`, `var(--text)`, `var(--accent)`
- Code preview: `var(--bg-muted)` background, `var(--text)` color
- Buttons: Follow existing button patterns in SessionControlBar

### Typography
- Title: `fontSize="lg"`, `fontWeight="600"`
- Code: `fontFamily="monospace"`, `fontSize="14px"`
- Explanation: `fontSize="sm"`, `color="gray.500"`
- Metadata: `fontSize="xs"`

### Animations
- Modal: Chakra's default modal animation
- Loading: Pulsing skeleton lines
- Success: Fade in drill content (0.3s)
- Error: Shake animation (optional)

---

## Files to Modify

1. `components/PreferencesDrawer.tsx` - Add AIKeyConfig section
2. `components/session/SessionControlBar.tsx` - Add AI Drill button
3. `components/ResultCard.tsx` - Add AI badge
4. `components/ShortcutsDrawer.tsx` - Add Shift+A shortcut
5. `components/TypingSession.tsx` - Wire up AIDrillPanel

## New Files to Create

1. `components/AIDrillPanel.tsx` - Main drill preview modal
2. `components/AILoadingSkeleton.tsx` - Loading state (optional, can inline)

---

## Testing Checklist

- [ ] AIKeyConfig shows in PreferencesDrawer
- [ ] AI Drill button shows only when enabled + has API key
- [ ] Badge shows remaining count correctly
- [ ] Clicking AI Drill button opens AIDrillPanel
- [ ] AIDrillPanel shows loading skeleton initially
- [ ] Generated code displays in preview
- [ ] "Use This Drill" loads snippet and starts session
- [ ] "Generate Another" creates new drill
- [ ] Escape closes modal
- [ ] Error state shows when generation fails
- [ ] Rate limit disables button with tooltip
- [ ] AI badge shows on result card for AI drills
- [ ] Shift+A shortcut documented in ShortcutsDrawer
- [ ] Feature hidden on mobile (<640px)

---

## Build Commands

```bash
# Check for errors
npm run lint

# Build the app
npm run build

# Run dev server
npm run dev
```

## Key Imports Reference

```typescript
// AI System
import { useAIDrills } from "@/hooks/useAIDrills";
import { hasApiKey, getActiveProvider } from "@/lib/ai/key-storage";
import { checkRateLimit, getRemainingToday } from "@/lib/ai/rate-limiter";

// Preferences
import { usePreferences } from "@/lib/preferences";

// Types
import type { Snippet, SupportedLanguage } from "@/lib/snippets";

// UI
import { 
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Button, Badge, Tag, Text, Box, VStack, HStack, Tooltip, Skeleton 
} from "@chakra-ui/react";
import { LuZap } from "react-icons/lu";
import { motion } from "framer-motion";
```

## Notes

- All new code should follow existing patterns in the codebase
- Use existing Chakra UI components and theme variables
- Follow the same error handling patterns (try/catch with console.error)
- Keep functions small and focused
- Add TypeScript types for all props and return values
- Mobile: Hide AI features entirely on screens <640px using CSS media queries or Chakra's responsive props
