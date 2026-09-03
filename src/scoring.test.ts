import { describe, expect, it } from 'vitest';
import {
  brierScore,
  brierSkill,
  brierVerdict,
  calibrationBuckets,
  brierTrend,
  meanBrier,
  overallStats,
  streaks,
} from './scoring.ts';
import type { Prediction } from './types.ts';

function p(partial: Partial<Prediction> & { confidence: number; status: Prediction['status'] }): Prediction {
  return {
    id: Math.random().toString(36),
    title: 't',
    details: '',
    rationale: '',
    disconfirm: '',
    category: 'Work',
    createdAt: '2026-01-01T00:00:00.000Z',
    resolveBy: null,
    resolvedAt: '2026-02-01T00:00:00.000Z',
    resolutionNote: '',
    tags: [],
    ...partial,
  };
}

describe('brierScore', () => {
  it('scores a correct 80% forecast as 0.04', () => {
    expect(brierScore(80, true)).toBeCloseTo(0.04, 10);
  });
  it('punishes confident errors hard (80% wrong = 0.64)', () => {
    expect(brierScore(80, false)).toBeCloseTo(0.64, 10);
  });
  it('scores 50% as 0.25 either way', () => {
    expect(brierScore(50, true)).toBeCloseTo(0.25, 10);
    expect(brierScore(50, false)).toBeCloseTo(0.25, 10);
  });
  it('clamps out-of-range input', () => {
    expect(brierScore(0, true)).toBeCloseTo(1, 10);
    expect(brierScore(100, false)).toBeCloseTo(1, 10);
  });
});

describe('meanBrier / skill / verdict', () => {
  it('returns null with no resolved predictions', () => {
    expect(meanBrier([])).toBeNull();
    expect(brierSkill(null)).toBeNull();
    expect(brierVerdict(null)).toMatch(/no resolved/i);
  });
  it('averages correctly and computes positive skill for good forecasts', () => {
    const list = [p({ confidence: 80, status: 'correct' }), p({ confidence: 80, status: 'correct' })];
    expect(meanBrier(list)).toBeCloseTo(0.04, 10);
    expect(brierSkill(0.04)).toBeCloseTo(0.84, 10);
  });
  it('gives negative skill to worse-than-baseline forecasts', () => {
    expect(brierSkill(0.4)).toBeLessThan(0);
  });
});

describe('overallStats', () => {
  it('computes accuracy, gap, and streaks', () => {
    const list = [
      p({ confidence: 80, status: 'correct', resolvedAt: '2026-01-01T00:00:00.000Z' }),
      p({ confidence: 80, status: 'correct', resolvedAt: '2026-01-02T00:00:00.000Z' }),
      p({ confidence: 90, status: 'incorrect', resolvedAt: '2026-01-03T00:00:00.000Z' }),
    ];
    const s = overallStats([...list, p({ confidence: 70, status: 'pending', resolvedAt: null })]);
    expect(s.total).toBe(4);
    expect(s.pending).toBe(1);
    expect(s.resolved).toBe(3);
    expect(s.accuracy).toBeCloseTo(2 / 3, 10);
    // avg confidence (80+80+90)/3 = 83.3% vs accuracy 66.7% → overconfident
    expect(s.calibrationGap).toBeGreaterThan(0.15);
    expect(s.currentStreak).toBe(0);
    expect(s.bestStreak).toBe(2);
  });
  it('handles empty journal', () => {
    const s = overallStats([]);
    expect(s.accuracy).toBeNull();
    expect(s.meanBrier).toBeNull();
    expect(s.bestStreak).toBe(0);
  });
});

describe('streaks', () => {
  it('orders by resolution time, not insertion order', () => {
    const list = [
      p({ confidence: 70, status: 'correct', resolvedAt: '2026-03-01T00:00:00.000Z' }),
      p({ confidence: 70, status: 'incorrect', resolvedAt: '2026-01-01T00:00:00.000Z' }),
      p({ confidence: 70, status: 'correct', resolvedAt: '2026-02-01T00:00:00.000Z' }),
    ];
    // ordered: miss, hit, hit → current streak 2, best 2
    expect(streaks(list)).toEqual({ bestStreak: 2, currentStreak: 2 });
  });
});

describe('calibrationBuckets', () => {
  it('buckets hit rates honestly, including sub-50 forecasts', () => {
    const list = [
      p({ confidence: 45, status: 'incorrect' }), // <50 bucket: said 45% happen, it didn't → hit 0%
      p({ confidence: 75, status: 'correct' }),
      p({ confidence: 78, status: 'incorrect' }),
    ];
    const buckets = calibrationBuckets(list);
    const sub50 = buckets[0] as (typeof buckets)[number];
    expect(sub50.n).toBe(1);
    expect(sub50.hitRate).toBe(0);
    const seventies = buckets.find((b) => b.label === '70–79') as (typeof buckets)[number];
    expect(seventies.n).toBe(2);
    expect(seventies.hitRate).toBeCloseTo(0.5, 10);
  });
  it('marks empty buckets with nulls', () => {
    const buckets = calibrationBuckets([]);
    expect(buckets).toHaveLength(6);
    expect(buckets.every((b) => b.n === 0 && b.hitRate === null)).toBe(true);
  });
});

describe('brierTrend', () => {
  it('produces cumulative averages in resolution order', () => {
    const list = [
      p({ confidence: 80, status: 'correct', resolvedAt: '2026-02-01T00:00:00.000Z' }), // 0.04
      p({ confidence: 80, status: 'incorrect', resolvedAt: '2026-03-01T00:00:00.000Z' }), // 0.64
    ];
    const trend = brierTrend(list);
    expect(trend).toHaveLength(2);
    expect(trend[0]?.cumulativeBrier).toBeCloseTo(0.04, 10);
    expect(trend[1]?.cumulativeBrier).toBeCloseTo(0.34, 10);
  });
});
