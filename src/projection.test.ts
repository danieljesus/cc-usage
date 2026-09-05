import { describe, expect, it } from 'vitest';
import type { HistoryPoint } from './data/history.js';
import { project } from './projection.js';

const HOUR = 60 * 60 * 1000;

function points(values: number[], startMs: number, stepMs: number): HistoryPoint[] {
  return values.map((v, i) => ({ ts: startMs + i * stepMs, fiveHour: v, sevenDay: null }));
}

describe('project', () => {
  const windowStart = new Date(0);

  it('returns null with fewer than 3 points', () => {
    const series = points([10, 20], 0, HOUR);
    expect(project(series, (p) => p.fiveHour, windowStart, null)).toBeNull();
  });

  it('returns null for a flat series (no real trend)', () => {
    const series = points([30, 30, 30, 30], 0, HOUR);
    expect(project(series, (p) => p.fiveHour, windowStart, null)).toBeNull();
  });

  it('computes a positive slope and an ETA for a rising series', () => {
    // +10%/hour starting at 0%.
    const series = points([0, 10, 20, 30], 0, HOUR);
    const result = project(series, (p) => p.fiveHour, windowStart, null);
    expect(result).not.toBeNull();
    expect(result?.slopePerHour).toBeCloseTo(10, 5);
    // Last sample at t=3h, value=30 -> hits 100 at t=10h.
    expect(result?.etaExhaustion?.getTime()).toBeCloseTo(10 * HOUR, -2);
  });

  it('flags exhaustsBeforeReset when the ETA lands before the reset', () => {
    const series = points([0, 10, 20, 30], 0, HOUR);
    // Last sample at t=3h, value=30, +10%/h -> ETA is t=10h. Reset at t=20h
    // happens after that, so quota runs out first.
    const resetsAt = new Date(20 * HOUR);
    const result = project(series, (p) => p.fiveHour, windowStart, resetsAt);
    expect(result?.verdict).toBe('exhaustsBeforeReset');
  });

  it('flags comfortable when the reset lands well before the ETA', () => {
    const series = points([0, 10, 20, 30], 0, HOUR);
    // Same +10%/h series, ETA t=10h. Reset at t=5h happens first, so the
    // window renews with margin to spare.
    const resetsAt = new Date(5 * HOUR);
    const result = project(series, (p) => p.fiveHour, windowStart, resetsAt);
    expect(result?.verdict).toBe('comfortable');
  });

  it('ignores points from before the current window', () => {
    const stale = points([90, 95], -10 * HOUR, HOUR);
    const fresh = points([0, 10, 20], 0, HOUR);
    const result = project([...stale, ...fresh], (p) => p.fiveHour, windowStart, null);
    expect(result?.slopePerHour).toBeCloseTo(10, 5);
  });

  it('never projects an ETA for a falling series', () => {
    const series = points([80, 70, 60, 50], 0, HOUR);
    const result = project(series, (p) => p.fiveHour, windowStart, null);
    expect(result?.slopePerHour).toBeLessThan(0);
    expect(result?.etaExhaustion).toBeNull();
  });
});
