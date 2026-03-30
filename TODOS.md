# TODOS

## Completed

### AI Drills: Define Length Category Mapping
**What:** Define explicit line count ranges per lengthCategory for AI-generated drills that match the existing classification in `lib/snippets.ts`.
**Context:** Found during /plan-eng-review (Codex outside voice, finding #5). Implemented in `lib/ai/prompt-builder.ts` via `LINE_RANGES` constant matching `lib/snippets.ts` `LENGTH_THRESHOLDS`.
**Completed:** v2.1.0 (2026-03-29)
