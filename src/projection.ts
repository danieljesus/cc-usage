import type { HistoryPoint } from './data/history.js';

const MIN_POINTS = 3;
/**
 * A regression over points that span only a few minutes is dominated by
 * poll-to-poll noise — the denominator in the slope's variance term is tiny,
 * so a couple of %-points of jitter turns into a wildly overstated %/hour
 * rate. Require real elapsed time before trusting the trend at all.
 *
 * A flat floor isn't enough on its own, though: 15 minutes is a meaningful
 * slice of a 5-hour window but nothing against a 7-day one — extrapolating
 * a week from half an hour of data is how a single +1 percentage-point tick
 * turned into "exhausts before reset" on a window sitting at 3% (seen in
 * practice). So the real floor is a fraction of the window's own length,
 * with MIN_SPAN_MS as the absolute lower bound for short windows.
 */
const MIN_SPAN_MS = 15 * 60 * 1000;
const MIN_SPAN_FRACTION_OF_WINDOW = 0.03;
/** Below this slope (%/hour) the trend is noise, not a real burn rate. */
const FLAT_SLOPE_THRESHOLD = 0.05;

export type Verdict = 'comfortable' | 'tight' | 'exhaustsBeforeReset';

export interface Projection {
  /** %/hour, positive means rising usage. */
  slopePerHour: number;
  /** Estimated time the window hits 100%, or null if it never will at this rate. */
  etaExhaustion: Date | null;
  verdict: Verdict;
}

/**
 * Linear regression of usage % over time, restricted to points from the
 * current window (i.e. since the last reset). Returns null when there isn't
 * enough signal yet — never invents a trend from fewer than 3 points, too
 * short an observed span relative to the window's own length, or a flat
 * line.
 */
export function project(
  points: HistoryPoint[],
  pickValue: (p: HistoryPoint) => number | null,
  currentWindowStart: Date,
  resetsAt: Date | null,
): Projection | null {
  const series = points
    .filter((p) => p.ts >= currentWindowStart.getTime())
    .map((p) => ({ ts: p.ts, value: pickValue(p) }))
    .filter((p): p is { ts: number; value: number } => p.value !== null);

  if (series.length < MIN_POINTS) return null;

  const observedSpanMs = series[series.length - 1].ts - series[0].ts;
  const windowDurationMs = resetsAt ? resetsAt.getTime() - currentWindowStart.getTime() : 0;
  const requiredSpanMs = Math.max(MIN_SPAN_MS, windowDurationMs * MIN_SPAN_FRACTION_OF_WINDOW);
  if (observedSpanMs < requiredSpanMs) return null;

  const slopePerHour = linearSlopePerHour(series);
  if (slopePerHour === null || Math.abs(slopePerHour) < FLAT_SLOPE_THRESHOLD) return null;

  const last = series[series.length - 1];
  let etaExhaustion: Date | null = null;
  if (slopePerHour > 0) {
    const hoursToFull = (100 - last.value) / slopePerHour;
    if (hoursToFull >= 0) {
      etaExhaustion = new Date(last.ts + hoursToFull * 60 * 60 * 1000);
    }
  }

  let verdict: Verdict = 'comfortable';
  if (etaExhaustion && resetsAt) {
    if (etaExhaustion.getTime() < resetsAt.getTime()) {
      verdict = 'exhaustsBeforeReset';
    } else if (etaExhaustion.getTime() - resetsAt.getTime() < 60 * 60 * 1000) {
      verdict = 'tight';
    }
  }

  return { slopePerHour, etaExhaustion, verdict };
}

/** Ordinary least squares slope, in units-per-hour, over {ts (ms), value} points. */
function linearSlopePerHour(series: { ts: number; value: number }[]): number | null {
  const n = series.length;
  const hours = series.map((p) => p.ts / (60 * 60 * 1000));
  const meanX = hours.reduce((a, b) => a + b, 0) / n;
  const meanY = series.reduce((a, p) => a + p.value, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = hours[i] - meanX;
    num += dx * (series[i].value - meanY);
    den += dx * dx;
  }

  if (den === 0) return null;
  return num / den;
}
