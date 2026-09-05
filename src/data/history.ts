import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const HISTORY_PATH = join(homedir(), '.claude', 'usage-history.jsonl');
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export interface HistoryPoint {
  ts: number; // epoch ms
  fiveHour: number | null;
  sevenDay: number | null;
}

let lastAppended: { fiveHour: number | null; sevenDay: number | null } | null = null;

/**
 * Appends a sample only when the values actually changed since the last
 * append — a naive 30s-interval log would write ~2,880 near-duplicate lines
 * a day. Silently no-ops on write failure; history is a nice-to-have, never
 * worth crashing the UI over.
 */
export async function appendIfChanged(point: HistoryPoint): Promise<void> {
  if (
    lastAppended &&
    lastAppended.fiveHour === point.fiveHour &&
    lastAppended.sevenDay === point.sevenDay
  ) {
    return;
  }
  lastAppended = { fiveHour: point.fiveHour, sevenDay: point.sevenDay };
  try {
    await appendFile(HISTORY_PATH, `${JSON.stringify(point)}\n`, 'utf-8');
  } catch {
    // Best-effort only.
  }
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
          points.push({
            ts: parsed.ts,
            fiveHour: typeof parsed.fiveHour === 'number' ? parsed.fiveHour : null,
            sevenDay: typeof parsed.sevenDay === 'number' ? parsed.sevenDay : null,
          });
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
    lastAppended = {
      fiveHour: kept[kept.length - 1].fiveHour,
      sevenDay: kept[kept.length - 1].sevenDay,
    };
  }
  return kept;
}
