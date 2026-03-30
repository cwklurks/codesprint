"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    getSnippetVarietyScore,
    getSnippetVarianceTag,
    getProblemSnippets,
    getProblems,
    getSnippet,
    type Problem,
    type Snippet,
    type SnippetLength,
    type SupportedLanguage,
} from "@/lib/snippets";

export type LengthFilter = SnippetLength | "all";

export interface UseSessionControlsProps {
    snippets: Snippet[];
    onResetEngine: () => void;
    getNextRecommendation?: (availableIds: string[], currentId: string) => string | null;
    language: SupportedLanguage;
    setLanguage: (lang: SupportedLanguage) => void;
}

export interface UseSessionControlsReturn {
    // Language
    language: SupportedLanguage;
    setLanguage: (lang: SupportedLanguage) => void;

    // Length preference
    lengthPreference: LengthFilter;
    setLengthPreference: (pref: LengthFilter) => void;

    // Problem selection
    problemOptions: Problem[];
    problemId: string;
    setProblemId: (id: string) => void;
    currentProblem: Problem | null;
    currentProblemIndex: number;

    // Snippet selection
    snippetOptions: Snippet[];
    snippetId: string;
    setSnippetId: (id: string) => void;
    snippet: Snippet;

    // Actions
    handleNextProblem: () => void;
    setSnippet: (snippet: Snippet) => void;
}

const RECENT_PROBLEM_WINDOW = 10;
const RECENT_VARIANCE_WINDOW = 6;
const VARIETY_POOL_SIZE = 5;

function pushRecent(history: string[], nextValue: string, limit: number): string[] {
    const withoutDup = history.filter((value) => value !== nextValue);
    withoutDup.push(nextValue);
    return withoutDup.slice(-limit);
}

function pickPreferredProblemId(problemOptions: Problem[], representativeByProblem: Map<string, Snippet>): string {
    if (problemOptions.length === 0) return "";

    const sorted = [...problemOptions].sort((a, b) => {
        const snippetA = representativeByProblem.get(a.id);
        const snippetB = representativeByProblem.get(b.id);
        const scoreA = snippetA ? getSnippetVarietyScore(snippetA) : Number.NEGATIVE_INFINITY;
        const scoreB = snippetB ? getSnippetVarietyScore(snippetB) : Number.NEGATIVE_INFINITY;
        if (scoreA !== scoreB) return scoreB - scoreA;
        return a.title.localeCompare(b.title);
    });

    return sorted[0]?.id ?? "";
}

/**
 * Hook to manage session controls including language, length, problem, and snippet selection
 * Extracted from TypingSession.tsx selection state management
 */
export function useSessionControls({
    snippets,
    onResetEngine,
    getNextRecommendation,
    language,
    setLanguage,
}: UseSessionControlsProps): UseSessionControlsReturn {
    const [lengthPreference, setLengthPreference] = useState<LengthFilter>("short");
    const recentProblemIdsRef = useRef<string[]>([]);
    const recentVarianceTagsRef = useRef<string[]>([]);
    const nextPoolOffsetRef = useRef(0);

    // Problem options based on language and length filter
    const problemOptions = useMemo<Problem[]>(() => {
        const options = getProblems(
            snippets,
            language,
            lengthPreference === "all" ? undefined : { length: lengthPreference }
        );
        return options;
    }, [language, lengthPreference, snippets]);

    const representativeByProblem = useMemo(() => {
        const map = new Map<string, Snippet>();
        for (const snippet of snippets) {
            if (snippet.language !== language) continue;
            if (lengthPreference !== "all" && snippet.lengthCategory !== lengthPreference) continue;
            const existing = map.get(snippet.problemId);
            if (!existing || getSnippetVarietyScore(snippet) > getSnippetVarietyScore(existing)) {
                map.set(snippet.problemId, snippet);
            }
        }
        return map;
    }, [snippets, language, lengthPreference]);

    const availableSnippets = useMemo(
        () =>
            snippets.filter(
                (snippet) =>
                    snippet.language === language &&
                    (lengthPreference === "all" || snippet.lengthCategory === lengthPreference)
            ),
        [snippets, language, lengthPreference]
    );

    const preferredProblemId = useMemo(
        () => pickPreferredProblemId(problemOptions, representativeByProblem),
        [problemOptions, representativeByProblem]
    );

    const [problemId, setProblemId] = useState(() => preferredProblemId);

    // Reset variation history on language/length changes.
    useEffect(() => {
        recentProblemIdsRef.current = [];
        recentVarianceTagsRef.current = [];
        nextPoolOffsetRef.current = 0;
    }, [language, lengthPreference]);

    // Auto-sync problemId when problemOptions changes
    useEffect(() => {
        if (problemOptions.length === 0) {
            if (problemId !== "") setProblemId("");
            return;
        }
        if (!problemOptions.some((problem) => problem.id === problemId)) {
            setProblemId(preferredProblemId || problemOptions[0].id);
        }
    }, [problemOptions, problemId, preferredProblemId]);

    // Snippet options based on selected problem
    const snippetOptions = useMemo<Snippet[]>(() => {
        if (!problemId) return [];
        const options = getProblemSnippets(
            snippets,
            language,
            problemId,
            lengthPreference === "all" ? undefined : { length: lengthPreference }
        );
        return options;
    }, [language, problemId, lengthPreference, snippets]);

    const [snippetId, setSnippetId] = useState(() => snippetOptions[0]?.id ?? "");

    // Auto-sync snippetId when snippetOptions changes
    useEffect(() => {
        if (snippetOptions.length === 0) {
            if (snippetId !== "") setSnippetId("");
            return;
        }
        if (!snippetOptions.some((option) => option.id === snippetId)) {
            setSnippetId(snippetOptions[0].id);
        }
    }, [snippetOptions, snippetId]);

    // Resolve the current snippet
    const snippet = useMemo(() => {
        if (snippetOptions.length === 0) {
            const filters = lengthPreference === "all" ? undefined : { length: lengthPreference };
            return getSnippet(snippets, language, filters);
        }
        const selected = snippetOptions.find((option) => option.id === snippetId);
        return selected ?? snippetOptions[0];
    }, [snippetOptions, snippetId, language, lengthPreference, snippets]);

    // Track recent problems + variation tags to avoid repetitive next selections.
    useEffect(() => {
        if (!snippet?.id) return;
        recentProblemIdsRef.current = pushRecent(recentProblemIdsRef.current, snippet.problemId, RECENT_PROBLEM_WINDOW);
        const varianceTag = getSnippetVarianceTag(snippet);
        recentVarianceTagsRef.current = pushRecent(recentVarianceTagsRef.current, varianceTag, RECENT_VARIANCE_WINDOW);
    }, [snippet]);

    // Current problem info
    const currentProblemIndex = problemOptions.findIndex((problem) => problem.id === problemId);
    const currentProblem: Problem | null = currentProblemIndex >= 0 ? problemOptions[currentProblemIndex] : null;

    // Navigate to next problem
    const handleNextProblem = useCallback(() => {
        if (problemOptions.length === 0) {
            return;
        }

        // Check spaced repetition recommendation first
        if (getNextRecommendation) {
            const availableSnippetIds = availableSnippets.map((s) => s.id);
            const recommended = getNextRecommendation(availableSnippetIds, snippet.id);
            if (recommended) {
                const recSnippet = availableSnippets.find((s) => s.id === recommended);
                if (recSnippet) {
                    onResetEngine();
                    setProblemId(recSnippet.problemId);
                    setSnippetId(recSnippet.id);
                    return;
                }
            }
        }

        const candidateProblems = problemOptions.filter((problem) => problem.id !== problemId);
        if (candidateProblems.length === 0) {
            return;
        }

        // Prefer higher-variance snippets and avoid recently visited problems/tags.
        const ranked = candidateProblems
            .map((problem) => {
                const rep = representativeByProblem.get(problem.id);
                const varietyScore = rep ? getSnippetVarietyScore(rep) : -100;
                const varianceTag = rep ? getSnippetVarianceTag(rep) : "full";
                const seenProblemPenalty = recentProblemIdsRef.current.includes(problem.id) ? 20 : 0;
                const seenVariancePenalty = recentVarianceTagsRef.current.includes(varianceTag) ? 6 : 0;

                return {
                    problem,
                    rank: varietyScore - seenProblemPenalty - seenVariancePenalty,
                };
            })
            .sort((a, b) => (a.rank === b.rank ? a.problem.title.localeCompare(b.problem.title) : b.rank - a.rank));

        const poolSize = Math.min(VARIETY_POOL_SIZE, ranked.length);
        const poolIndex = nextPoolOffsetRef.current % poolSize;
        nextPoolOffsetRef.current += 1;
        const nextProblem = ranked[poolIndex]?.problem ?? ranked[0]?.problem;
        if (!nextProblem) return;

        onResetEngine();
        setProblemId(nextProblem.id);
    }, [problemId, problemOptions, snippet, onResetEngine, getNextRecommendation, representativeByProblem, availableSnippets]);

    // Directly set a custom snippet (for AI drills)
    const setSnippet = useCallback((newSnippet: Snippet) => {
        onResetEngine();
        setProblemId(newSnippet.problemId);
        setSnippetId(newSnippet.id);
    }, [onResetEngine]);

    return {
        language,
        setLanguage,
        lengthPreference,
        setLengthPreference,
        problemOptions,
        problemId,
        setProblemId,
        currentProblem,
        currentProblemIndex,
        snippetOptions,
        snippetId,
        setSnippetId,
        snippet,
        handleNextProblem,
        setSnippet,
    };
}
