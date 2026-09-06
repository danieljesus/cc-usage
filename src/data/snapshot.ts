import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { UsageWindow } from './usage-api.js';

const SNAPSHOT_PATH = join(homedir(), '.claude', 'usage-snapshot.json');

interface RawWindow {
  used_percentage?: number;
  resets_at?: number;
}

interface SnapshotFile {
  ts?: number;
  rate_limits?: {
    five_hour?: RawWindow;
    seven_day?: RawWindow;
  };
}

function toWindow(raw: RawWindow | undefined): UsageWindow | null {
  if (!raw || typeof raw.used_percentage !== 'number') return null;
  const resetsAt = typeof raw.resets_at === 'number' ? new Date(raw.resets_at * 1000) : null;
  return { utilization: raw.used_percentage, resetsAt };
}

/**
 * Fallback source: written by statusline-command.py's snapshot hook every
 * time any Claude Code session renders its statusline. Only carries the two
 * windows the statusline itself shows (five_hour, seven_day) — used when
 * the API poll fails and no session has run recently enough to be fresher.
 */
export async function readSnapshot(): Promise<{
  fetchedAt: Date;
  fiveHour: UsageWindow | null;
  sevenDay: UsageWindow | null;
} | null> {
  try {
    const raw = await readFile(SNAPSHOT_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as SnapshotFile;
    if (typeof parsed.ts !== 'number') return null;
    return {
      fetchedAt: new Date(parsed.ts * 1000),
      fiveHour: toWindow(parsed.rate_limits?.five_hour),
      sevenDay: toWindow(parsed.rate_limits?.seven_day),
    };
  } catch {
    return null;
  }
}
