"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupportedLanguage } from "@/lib/snippets";
import type { MasteryRecord } from "@/lib/spaced-repetition";
import {
    computeQualityRating,
    computeSM2,
    getMasteryStatus,
    isOverdue,
    sortByReviewPriority,
    getDefaultMasteryRecord,
} from "@/lib/spaced-repetition";
import { idbGetAll, idbPut, idbGet, STORES } from "@/lib/storage/idb-store";
import type { MasteryRecord as IdbMasteryRecord } from "@/lib/storage/idb-store";

export type MasteryInfo = {
    status: "new" | "learning" | "due" | "mastered";
    nextReviewDate: string;
    attempts: number;
};

export interface UseSpacedRepetitionReturn {
    masteryMap: Map<string, MasteryInfo>;
    dueCount: number;
    getNextRecommendation: (availableIds: string[], currentId: string) => string | null;
    updateMastery: (params: {
        snippetId: string;
        language: string;
        accuracy: number;
        patternScore?: number;
    }) => Promise<void>;
    isLoading: boolean;
}

function idbToSrRecord(r: IdbMasteryRecord): MasteryRecord {
    return {
        snippetId: r.snippetId,
        language: r.language,
        easeFactor: r.easeFactor,
        interval: r.interval,
        repetitions: r.repetitions,
        nextReviewDate: r.nextReviewDate,
        lastQuality: r.lastQuality,
        lastReviewDate: r.lastReviewDate,
        bestWpm: r.bestWpm,
        bestAccuracy: r.bestAccuracy,
        attempts: r.attempts,
    };
}

export function useSpacedRepetition(
    language: SupportedLanguage,
    enabled: boolean
): UseSpacedRepetitionReturn {
    const [masteryMap, setMasteryMap] = useState<Map<string, MasteryInfo>>(new Map());
    const [records, setRecords] = useState<MasteryRecord[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const loadRecords = useCallback(async () => {
        if (!enabled) {
            setMasteryMap(new Map());
            setRecords([]);
            return;
        }

        setIsLoading(true);
        try {
            const all = await idbGetAll<IdbMasteryRecord>(STORES.mastery);
            const languageRecords: MasteryRecord[] = [];
            for (const r of all) {
                if (r.language === language) languageRecords.push(idbToSrRecord(r));
            }

            setRecords(languageRecords);

            const map = new Map<string, MasteryInfo>();
            for (const r of languageRecords) {
                map.set(r.snippetId, {
                    status: getMasteryStatus(r),
                    nextReviewDate: r.nextReviewDate,
                    attempts: r.attempts,
                });
            }
            setMasteryMap(map);
        } catch (error) {
            console.error("[useSpacedRepetition] Failed to load records:", error);
        } finally {
            setIsLoading(false);
        }
    }, [language, enabled]);

    useEffect(() => {
        loadRecords();
    }, [loadRecords]);

    const dueCount = enabled
        ? records.filter((r) => isOverdue(r)).length
        : 0;

    const getNextRecommendation = useCallback(
        (availableIds: string[], currentId: string): string | null => {
            if (!enabled) return null;

            const overdueRecords = records.filter(
                (r) => isOverdue(r) && availableIds.includes(r.snippetId) && r.snippetId !== currentId
            );

            if (overdueRecords.length === 0) return null;

            const sorted = sortByReviewPriority(overdueRecords);
            return sorted[0]?.snippetId ?? null;
        },
        [enabled, records]
    );

    const updateMastery = useCallback(
        async (params: {
            snippetId: string;
            language: string;
            accuracy: number;
            patternScore?: number;
        }): Promise<void> => {
            if (!enabled) return;

            try {
                const existing = await idbGet<IdbMasteryRecord>(STORES.mastery, params.snippetId);
                const record: MasteryRecord = existing
                    ? idbToSrRecord(existing)
                    : getDefaultMasteryRecord(params.snippetId, params.language);

                const quality = computeQualityRating(params.accuracy, params.patternScore);
                const sm2Result = computeSM2({
                    easeFactor: record.easeFactor,
                    interval: record.interval,
                    repetitions: record.repetitions,
                    quality,
                });

                const today = new Date();
                const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

                const updated: IdbMasteryRecord = {
                    snippetId: params.snippetId,
                    language: params.language,
                    easeFactor: sm2Result.easeFactor,
                    interval: sm2Result.interval,
                    repetitions: sm2Result.repetitions,
                    nextReviewDate: sm2Result.nextReviewDate,
                    lastQuality: quality,
                    lastReviewDate: dateStr,
                    bestWpm: existing?.bestWpm ?? 0,
                    bestAccuracy: Math.max(existing?.bestAccuracy ?? 0, params.accuracy),
                    attempts: (existing?.attempts ?? 0) + 1,
                    lastPracticed: new Date().toISOString(),
                };

                await idbPut(STORES.mastery, updated);
                await loadRecords();
            } catch (error) {
                console.error("[useSpacedRepetition] Failed to update mastery:", error);
            }
        },
        [enabled, loadRecords]
    );

    return {
        masteryMap,
        dueCount,
        getNextRecommendation,
        updateMastery,
        isLoading,
    };
}
