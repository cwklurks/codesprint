/**
 * Skill Feed - Cross-Session Weak Pattern Aggregation
 * 
 * Aggregates weak patterns across multiple sessions to build
 * a comprehensive view of the user's typing weaknesses for AI drill
 * generation.
 */

import { analyzeWeakPatterns, type WeakPattern } from "@/lib/pattern-analysis";
import { tokenize } from "@/lib/tokenizer";
import { getWeights } from "@/lib/token-weights";
import type { SupportedLanguage, SnippetLength, Difficulty } from "@/lib/snippets";
import type { DrillRequest } from "./types";
import type { SessionRecord } from "@/lib/storage/session-history";
import { getSessionsAsync } from "@/lib/storage/session-history";
import { idbGetAll, STORES } from "@/lib/storage/idb-store";
import type { SkillModelRecord, CustomSnippetRecord } from "@/lib/storage/idb-store";
import type { AIMetadata } from "./types";

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

// Category labels for display
const CATEGORY_LABELS: Record<string, string> = {
    keyword: "Keywords",
    operator: "Operators",
    delimiter: "Delimiters",
    identifier: "Identifiers",
    literal: "Literals",
    string: "Strings",
    comment: "Comments",
    whitespace: "Whitespace",
};

/**
 * Aggregate weak patterns across multiple sessions
 */
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
        // Use stored snippet content to re-tokenize for pattern analysis
        if (!session.snippetContent) continue;
        const tokens = tokenize(session.snippetContent, language);
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
            category: category as WeakPattern["category"],
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

/**
 * Get the skill model for a language
 */
async function getSkillModel(language: SupportedLanguage): Promise<SkillModelRecord | null> {
    try {
        const { idbGet, STORES } = await import("@/lib/storage/idb-store");
        const model = await idbGet<SkillModelRecord>(STORES.skillModels, language);
        return model ?? null;
    } catch {
        return null;
    }
}

/**
 * Get recent AI drills for deduplication
 */
async function getRecentAIDrills(language: SupportedLanguage, limit: number): Promise<Array<CustomSnippetRecord & { aiMetadata?: AIMetadata }>> {
    try {
        const snippets = await idbGetAll<CustomSnippetRecord>(STORES.customSnippets);
        return snippets
            .filter((s): s is CustomSnippetRecord & { aiMetadata?: AIMetadata } => 
                s.language === language && s.source === "ai"
            )
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, limit);
    } catch {
        return [];
    }
}

/**
 * Infer length category from skill model
 */
function inferLengthFromSkill(skillModel: SkillModelRecord | null): SnippetLength {
    if (!skillModel) return "short";
    
    // Beginners get short drills
    if (skillModel.sessionCount < 5) return "short";
    if (skillModel.sessionCount < 15) return "medium";
    
    // Based on current difficulty preference
    if (skillModel.currentDifficulty === "easy") return "short";
    if (skillModel.currentDifficulty === "hard") return "long";
    
    return "medium";
}

// Preferences interface for type safety
interface PreferencesState {
    aiDrillLengthPreference?: SnippetLength | "auto";
}

/**
 * Build a drill request from user context
 */
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
        preferences.aiDrillLengthPreference === "auto" || !preferences.aiDrillLengthPreference
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
