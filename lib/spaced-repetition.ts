// SM-2 spaced repetition algorithm — pure functions, no IO

export type QualityRating = 0 | 1 | 2 | 3 | 4 | 5;

export type SM2Input = {
  easeFactor: number;
  interval: number; // days
  repetitions: number;
  quality: QualityRating;
};

export type SM2Output = {
  easeFactor: number;
  interval: number; // days
  repetitions: number;
  nextReviewDate: string; // "YYYY-MM-DD"
};

export type MasteryRecord = {
  snippetId: string;
  language: string;
  easeFactor: number; // default 2.5
  interval: number; // days
  repetitions: number;
  nextReviewDate: string; // "YYYY-MM-DD"
  lastQuality: number; // 0-5
  lastReviewDate: string;
  bestWpm: number;
  bestAccuracy: number;
  attempts: number;
};

export type MasteryStatus = "new" | "learning" | "due" | "mastered";

function addDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getToday(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function computeQualityRating(
  accuracy: number,
  patternScore?: number,
): QualityRating {
  if (
    accuracy > 0.98 &&
    (patternScore === undefined || patternScore > 90)
  ) {
    return 5;
  }
  if (
    accuracy > 0.95 &&
    (patternScore === undefined || patternScore > 80)
  ) {
    return 4;
  }
  if (accuracy > 0.9) return 3;
  if (accuracy > 0.8) return 2;
  if (accuracy > 0.7) return 1;
  return 0;
}

export function computeSM2(input: SM2Input, today?: string): SM2Output {
  const t = today ?? getToday();
  const { quality, easeFactor, interval, repetitions } = input;

  let newInterval: number;
  let newRepetitions: number;

  if (quality >= 3) {
    if (repetitions === 0) {
      newInterval = 1;
    } else if (repetitions === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.round(interval * easeFactor);
    }
    newRepetitions = repetitions + 1;
  } else {
    newInterval = 1;
    newRepetitions = 0;
  }

  const rawEF =
    easeFactor +
    (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  const newEF = Math.max(1.3, rawEF);

  return {
    easeFactor: newEF,
    interval: newInterval,
    repetitions: newRepetitions,
    nextReviewDate: addDays(t, newInterval),
  };
}

export function isOverdue(record: MasteryRecord, today?: string): boolean {
  const t = today ?? getToday();
  return record.nextReviewDate <= t;
}

export function getMasteryStatus(
  record: MasteryRecord,
  today?: string,
): MasteryStatus {
  if (isOverdue(record, today)) return "due";
  if (record.repetitions === 0) return "new";
  if (record.interval >= 21) return "mastered";
  return "learning";
}

export function sortByReviewPriority(
  records: readonly MasteryRecord[],
  today?: string,
): MasteryRecord[] {
  const t = today ?? getToday();
  return records.toSorted((a, b) => {
    const aOverdue = isOverdue(a, t);
    const bOverdue = isOverdue(b, t);

    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    if (aOverdue && bOverdue) {
      return a.nextReviewDate < b.nextReviewDate ? -1 : 1;
    }
    return a.interval - b.interval;
  });
}

export function getDefaultMasteryRecord(
  snippetId: string,
  language: string,
): MasteryRecord {
  return {
    snippetId,
    language,
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReviewDate: "9999-12-31",
    lastQuality: 0,
    lastReviewDate: "1970-01-01",
    bestWpm: 0,
    bestAccuracy: 0,
    attempts: 0,
  };
}
