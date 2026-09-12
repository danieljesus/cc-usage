import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const HISTORY_PATH = join(homedir(), '.claude', 'usage-history.jsonl');
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export interface HistoryPoint {
  ts: number; // epoch ms
  fiveHour: number | null;
  sevenDay: number | null;
  /**
   * Per-model caps keyed by `modelCaps()`'s key (app.tsx), e.g. `fable:7d`.
   * Omitted entirely (not `{}`) when the API reported none, so lines written
   * before this field existed and lines from plans without per-model caps
   * look the same.
   */
  models?: Record<string, number>;
}

type PointValues = Pick<HistoryPoint, 'fiveHour' | 'sevenDay' | 'models'>;

let lastAppended: PointValues | null = null;

function sameModels(a: Record<string, number> | undefined, b: Record<string, number> | undefined) {
  const ka = Object.keys(a ?? {});
  const kb = Object.keys(b ?? {});
  if (ka.length !== kb.length) return false;
  return ka.every((k) => a?.[k] === b?.[k]);
}

/** True when two samples carry the same readings — the only thing worth a new history line. */
export function sameValues(a: PointValues, b: PointValues): boolean {
  return a.fiveHour === b.fiveHour && a.sevenDay === b.sevenDay && sameModels(a.models, b.models);
}

/**
 * Appends a sample only when the values actually changed since the last
 * append — a naive 30s-interval log would write ~2,880 near-duplicate lines
 * a day. Silently no-ops on write failure; history is a nice-to-have, never
 * worth crashing the UI over.
 */
export async function appendIfChanged(point: HistoryPoint): Promise<void> {
  if (lastAppended && sameValues(lastAppended, point)) return;
  lastAppended = { fiveHour: point.fiveHour, sevenDay: point.sevenDay, models: point.models };
  try {
    await appendFile(HISTORY_PATH, `${JSON.stringify(point)}\n`, 'utf-8');
  } catch {
    // Best-effort only.
  }
}

function toModels(raw: unknown): Record<string, number> | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined;
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export async function readHistory(): Promise<HistoryPoint[]> {
  try {
    const raw = await readFile(HISTORY_PATH, 'utf-8');
    const points: HistoryPoint[] = [];
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line) as Partial<HistoryPoint>;
        if (typeof parsed.ts === 'number') {
          const point: HistoryPoint = {
            ts: parsed.ts,
            fiveHour: typeof parsed.fiveHour === 'number' ? parsed.fiveHour : null,
            sevenDay: typeof parsed.sevenDay === 'number' ? parsed.sevenDay : null,
          };
          const models = toModels(parsed.models);
          if (models) point.models = models;
          points.push(point);
        }
      } catch {
        // Skip malformed line.
      }
    }
    return points;
  } catch {
    return [];
  }
}

/**
 * Drops points older than the 7-day window on startup — the only history
 * that's ever useful is inside the current weekly window, and this keeps
 * the file from growing forever.
 */
export async function pruneOnStartup(): Promise<HistoryPoint[]> {
  const points = await readHistory();
  const cutoff = Date.now() - SEVEN_DAYS_MS;
  const kept = points.filter((p) => p.ts >= cutoff);
  if (kept.length !== points.length) {
    try {
      await writeFile(HISTORY_PATH, `${kept.map((p) => JSON.stringify(p)).join('\n')}\n`, 'utf-8');
    } catch {
      // Best-effort only.
    }
  }
  if (kept.length > 0) {
    const last = kept[kept.length - 1];
    lastAppended = { fiveHour: last.fiveHour, sevenDay: last.sevenDay, models: last.models };
  }
  return kept;
}
