import type { Prediction } from './types.ts';

/**
 * Scoring engine — pure functions, no I/O.
 *
 * We use the Brier score: mean((forecast - outcome)^2).
 * Lower is better. 0 = perfect, 1 = worst possible, 0.25 = always saying 50%.
 */

export function brierScore(confidencePercent: number, happened: boolean): number {
  const f = clamp01(confidencePercent / 100);
  const o = happened ? 1 : 0;
  return (f - o) ** 2;
}

export function meanBrier(resolved: Prediction[]): number | null {
  if (resolved.length === 0) return null;
  let sum = 0;
  for (const p of resolved) sum += brierScore(p.confidence, p.status === 'correct');
  return sum / resolved.length;
}

/** Brier skill vs. a baseline that always forecasts 50%. Positive = you beat the baseline. */
export function brierSkill(meanBrierValue: number | null): number | null {
  if (meanBrierValue === null) return null;
  const baseline = 0.25;
  return 1 - meanBrierValue / baseline;
}

export interface OverallStats {
  total: number;
  pending: number;
  resolved: number;
  correct: number;
  accuracy: number | null;
  avgConfidence: number | null;
  meanBrier: number | null;
  skill: number | null;
  /** avgConfidence − accuracy. Positive = overconfident. */
  calibrationGap: number | null;
  bestStreak: number;
  currentStreak: number;
}

export function overallStats(all: Prediction[]): OverallStats {
  const resolved = all.filter((p) => p.status !== 'pending');
  const correct = resolved.filter((p) => p.status === 'correct').length;
  const accuracy = resolved.length > 0 ? correct / resolved.length : null;
  const avgConfidence =
    resolved.length > 0 ? resolved.reduce((s, p) => s + p.confidence, 0) / resolved.length / 100 : null;
  const mb = meanBrier(resolved);
  const skill = brierSkill(mb);
  const calibrationGap =
    avgConfidence !== null && accuracy !== null ? avgConfidence - accuracy : null;
  const { bestStreak, currentStreak } = streaks(resolved);
  return {
    total: all.length,
    pending: all.length - resolved.length,
    resolved: resolved.length,
    correct,
    accuracy,
    avgConfidence,
    meanBrier: mb,
    skill,
    calibrationGap,
    bestStreak,
    currentStreak,
  };
}

/** Consecutive-correct streaks, ordered by resolution time. */
export function streaks(resolved: Prediction[]): { bestStreak: number; currentStreak: number } {
  const ordered = [...resolved].sort((a, b) =>
    (a.resolvedAt ?? a.createdAt).localeCompare(b.resolvedAt ?? b.createdAt),
  );
  let best = 0;
  let run = 0;
  for (const p of ordered) {
    if (p.status === 'correct') {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }
  return { bestStreak: best, currentStreak: run };
}

export interface CalibrationBucket {
  label: string;
  low: number; // inclusive, percent
  high: number; // exclusive, percent (last bucket inclusive of 100)
  n: number;
  hitRate: number | null; // fraction that happened
  avgConfidence: number | null; // mean stated confidence, 0..1
}

const BUCKET_DEFS: Array<[string, number, number]> = [
  ['< 50', 0, 50],
  ['50–59', 50, 60],
  ['60–69', 60, 70],
  ['70–79', 70, 80],
  ['80–89', 80, 90],
  ['90+', 90, 101],
];

/** Group resolved predictions by stated confidence; compare hit rate to the diagonal. */
export function calibrationBuckets(resolved: Prediction[]): CalibrationBucket[] {
  return BUCKET_DEFS.map(([label, low, high]) => {
    const inBucket = resolved.filter((p) => p.confidence >= low && p.confidence < high);
    if (inBucket.length === 0) {
      return { label, low, high, n: 0, hitRate: null, avgConfidence: null };
    }
    const hits = inBucket.filter((p) => p.status === 'correct').length;
    const avg = inBucket.reduce((s, p) => s + p.confidence, 0) / inBucket.length / 100;
    return { label, low, high, n: inBucket.length, hitRate: hits / inBucket.length, avgConfidence: avg };
  });
}

export interface TrendPoint {
  index: number;
  cumulativeBrier: number;
  label: string;
}

/** Cumulative mean Brier score in resolution order — falling line = improving judgment. */
export function brierTrend(resolved: Prediction[]): TrendPoint[] {
  const ordered = [...resolved].sort((a, b) =>
    (a.resolvedAt ?? a.createdAt).localeCompare(b.resolvedAt ?? b.createdAt),
  );
  let sum = 0;
  return ordered.map((p, i) => {
    sum += brierScore(p.confidence, p.status === 'correct');
    return { index: i + 1, cumulativeBrier: sum / (i + 1), label: shortTitle(p.title) };
  });
}

function shortTitle(title: string): string {
  return title.length > 42 ? title.slice(0, 41) + '…' : title;
}

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0.5;
  return Math.min(1, Math.max(0, x));
}

/** Human-readable verdict for a mean Brier score. */
export function brierVerdict(mb: number | null): string {
  if (mb === null) return 'No resolved predictions yet';
  if (mb < 0.1) return 'Superforecaster territory';
  if (mb < 0.16) return 'Sharply calibrated';
  if (mb < 0.25) return 'Beating coin-flip';
  if (mb === 0.25) return 'Exactly coin-flip';
  return 'Worse than coin-flip — good news: that is fixable';
}

export function formatPercent(x: number | null, digits = 0): string {
  if (x === null || Number.isNaN(x)) return '—';
  return `${(x * 100).toFixed(digits)}%`;
}
