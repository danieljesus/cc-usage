import { readFile, readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { sanitizeWidth } from '../sanitize-width.js';

const SESSIONS_DIR = join(homedir(), '.claude', 'sessions');
const ROSTER_PATH = join(homedir(), '.claude', 'daemon', 'roster.json');
const HOME = homedir();

/** Sessions whose statusUpdatedAt is older than this are treated as dead and dropped. */
const STALE_MS = 10 * 60 * 1000;

export type SessionActivity = 'working' | 'idle';

export interface SessionInfo {
  pid: number;
  name: string;
  cwd: string;
  activity: SessionActivity;
  updatedAt: Date;
  /** True when this session is a background agent (from daemon/roster.json), not an interactive terminal. */
  background: boolean;
}

interface SessionFile {
  pid?: number;
  cwd?: string;
  name?: string;
  status?: string;
  updatedAt?: number;
  statusUpdatedAt?: number;
}

interface RosterWorker {
  pid?: number;
  cwd?: string;
  dispatch?: {
    seed?: { intent?: string; name?: string };
    source?: string;
  };
}

interface RosterFile {
  workers?: Record<string, RosterWorker>;
}

function pidIsAlive(pid: number): boolean {
  try {
    // Signal 0 probes existence without actually signaling the process.
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function shortenCwd(cwd: string): string {
  const posixCwd = cwd.replace(/\\/g, '/');
  const posixHome = HOME.replace(/\\/g, '/');
  return posixCwd.toLowerCase().startsWith(posixHome.toLowerCase())
    ? `~${posixCwd.slice(posixHome.length)}`
    : posixCwd;
}

function activityFor(status: string | undefined): SessionActivity {
  return status === 'idle' ? 'idle' : 'working';
}

/**
 * Live-session roster: sessions/<pid>.json for interactive terminals, cross-referenced
 * with daemon/roster.json's background workers so a spawned fork/agent shows a
 * meaningful label (its seed intent) instead of a generic name. Drops any entry
 * whose PID no longer exists or whose last update is stale — otherwise dead
 * sessions accumulate forever since nothing deletes these files on exit.
 */
export async function readSessions(): Promise<SessionInfo[]> {
  const roster = await readRoster();
  const rosterByPid = new Map<number, RosterWorker>();
  for (const worker of roster) {
    if (typeof worker.pid === 'number') rosterByPid.set(worker.pid, worker);
  }

  let files: string[];
  try {
    files = (await readdir(SESSIONS_DIR)).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }

  const now = Date.now();
  const out: SessionInfo[] = [];

  for (const file of files) {
    try {
      const raw = await readFile(join(SESSIONS_DIR, file), 'utf-8');
      const parsed = JSON.parse(raw) as SessionFile;
      if (typeof parsed.pid !== 'number' || !parsed.cwd) continue;
      const updatedMs = parsed.statusUpdatedAt ?? parsed.updatedAt;
      if (typeof updatedMs !== 'number') continue;
      if (now - updatedMs > STALE_MS) continue;
      if (!pidIsAlive(parsed.pid)) continue;

      const worker = rosterByPid.get(parsed.pid);
      const label = parsed.name || worker?.dispatch?.seed?.name || worker?.dispatch?.seed?.intent;

      out.push({
        pid: parsed.pid,
        // Sanitized here, at the data boundary, so every consumer of
        // SessionInfo gets terminal-safe text — not just the one rendering
        // path we happened to be looking at when we found the problem.
        name: sanitizeWidth(label || `pid ${parsed.pid}`),
        cwd: sanitizeWidth(shortenCwd(parsed.cwd)),
        activity: activityFor(parsed.status),
        updatedAt: new Date(updatedMs),
        background: worker !== undefined,
      });
    } catch {
      // Skip unreadable/mid-write files rather than fail the whole listing.
    }
  }

  return out.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

async function readRoster(): Promise<RosterWorker[]> {
  try {
    const raw = await readFile(ROSTER_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as RosterFile;
    return Object.values(parsed.workers ?? {});
  } catch {
    return [];
  }
}
