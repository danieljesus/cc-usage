import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:os', () => ({ homedir: () => '/home/testuser' }));
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  readdir: vi.fn(),
}));

import { readFile, readdir } from 'node:fs/promises';
import { readSessions } from './sessions.js';

const NOW = 1_800_000_000_000;
const STALE_MS = 10 * 60 * 1000;

function sessionFile(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    pid: 111,
    cwd: '/home/testuser/IdeaProjects/cc-usage',
    name: 'my-session',
    status: 'working',
    statusUpdatedAt: NOW - 60_000,
    ...overrides,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.mocked(readdir).mockReset();
  vi.mocked(readFile).mockReset();
  // Roster read (daemon/roster.json) is a separate readFile call this suite
  // mostly doesn't care about — default it to "not found" so every test
  // doesn't have to configure it explicitly.
  vi.mocked(readFile).mockImplementation(async (path) => {
    if (String(path).includes('roster.json'))
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    throw new Error(`unstubbed readFile path: ${path}`);
  });
  vi.spyOn(process, 'kill').mockReturnValue(true);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function stubSessionFiles(files: Record<string, string>) {
  vi.mocked(readdir).mockResolvedValue(Object.keys(files) as never);
  const original = vi.mocked(readFile).getMockImplementation();
  vi.mocked(readFile).mockImplementation(async (path) => {
    const name = String(path).split(/[/\\]/).pop() ?? '';
    if (name in files) return files[name];
    return original?.(path as never) as never;
  });
}

describe('readSessions', () => {
  it('returns a session whose PID is alive and recently updated', async () => {
    stubSessionFiles({ '111.json': sessionFile() });
    const sessions = await readSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ pid: 111, name: 'my-session', activity: 'working' });
  });

  it('drops a session whose PID no longer exists', async () => {
    stubSessionFiles({ '111.json': sessionFile() });
    vi.mocked(process.kill).mockImplementation(() => {
      throw new Error('ESRCH');
    });
    expect(await readSessions()).toEqual([]);
  });

  it('drops a session stale by more than 10 minutes', async () => {
    stubSessionFiles({
      '111.json': sessionFile({ statusUpdatedAt: NOW - STALE_MS - 1000 }),
    });
    expect(await readSessions()).toEqual([]);
  });

  it('keeps a session exactly at the staleness boundary', async () => {
    stubSessionFiles({ '111.json': sessionFile({ statusUpdatedAt: NOW - STALE_MS }) });
    expect(await readSessions()).toHaveLength(1);
  });

  it('prefers statusUpdatedAt over updatedAt when both are present', async () => {
    stubSessionFiles({
      '111.json': sessionFile({ statusUpdatedAt: NOW - 60_000, updatedAt: NOW - STALE_MS - 1000 }),
    });
    const sessions = await readSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].updatedAt).toEqual(new Date(NOW - 60_000));
  });

  it('falls back to updatedAt when statusUpdatedAt is missing', async () => {
    stubSessionFiles({
      '111.json': sessionFile({ statusUpdatedAt: undefined, updatedAt: NOW - 60_000 }),
    });
    expect(await readSessions()).toHaveLength(1);
  });

  it('skips a file missing pid or cwd', async () => {
    stubSessionFiles({
      'a.json': sessionFile({ pid: undefined }),
      'b.json': sessionFile({ pid: 222, cwd: undefined }),
    });
    expect(await readSessions()).toEqual([]);
  });

  it('skips an unreadable/malformed file without failing the whole listing', async () => {
    stubSessionFiles({
      'bad.json': '{not valid json',
      'good.json': sessionFile({ pid: 222 }),
    });
    const sessions = await readSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].pid).toBe(222);
  });

  it('maps status "idle" to activity "idle" and anything else to "working"', async () => {
    stubSessionFiles({
      '111.json': sessionFile({ pid: 111, status: 'idle' }),
      '222.json': sessionFile({ pid: 222, status: 'busy-or-whatever' }),
    });
    const sessions = await readSessions();
    const byPid = Object.fromEntries(sessions.map((s) => [s.pid, s.activity]));
    expect(byPid[111]).toBe('idle');
    expect(byPid[222]).toBe('working');
  });

  it('shortens a home-prefixed cwd to a ~ path', async () => {
    stubSessionFiles({ '111.json': sessionFile({ cwd: '/home/testuser/projects/foo' }) });
    const sessions = await readSessions();
    expect(sessions[0].cwd).toBe('~/projects/foo');
  });

  it('leaves a non-home cwd absolute', async () => {
    stubSessionFiles({ '111.json': sessionFile({ cwd: '/var/data/other' }) });
    const sessions = await readSessions();
    expect(sessions[0].cwd).toBe('/var/data/other');
  });

  it('returns an empty list when the sessions directory does not exist', async () => {
    vi.mocked(readdir).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    expect(await readSessions()).toEqual([]);
  });

  it('sorts sessions by most recently updated first', async () => {
    stubSessionFiles({
      'older.json': sessionFile({ pid: 111, statusUpdatedAt: NOW - 5 * 60_000 }),
      'newer.json': sessionFile({ pid: 222, statusUpdatedAt: NOW - 60_000 }),
    });
    const sessions = await readSessions();
    expect(sessions.map((s) => s.pid)).toEqual([222, 111]);
  });

  describe('roster cross-reference', () => {
    function withRoster(rosterJson: string, files: Record<string, string>) {
      vi.mocked(readdir).mockResolvedValue(Object.keys(files) as never);
      vi.mocked(readFile).mockImplementation(async (path) => {
        const p = String(path);
        if (p.includes('roster.json')) return rosterJson;
        const name = p.split(/[/\\]/).pop() ?? '';
        if (name in files) return files[name];
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      });
    }

    it('labels a session from the roster seed name when the session has no name', async () => {
      withRoster(
        JSON.stringify({
          workers: { w1: { pid: 111, dispatch: { seed: { name: 'fork task' } } } },
        }),
        { '111.json': sessionFile({ name: undefined }) },
      );
      const sessions = await readSessions();
      expect(sessions[0].name).toBe('fork task');
      expect(sessions[0].background).toBe(true);
    });

    it('falls back to the roster seed intent when there is no seed name', async () => {
      withRoster(
        JSON.stringify({
          workers: { w1: { pid: 111, dispatch: { seed: { intent: 'investigate the bug' } } } },
        }),
        { '111.json': sessionFile({ name: undefined }) },
      );
      const sessions = await readSessions();
      expect(sessions[0].name).toBe('investigate the bug');
    });

    it('falls back to "pid N" when no name is available anywhere', async () => {
      withRoster(JSON.stringify({ workers: {} }), { '111.json': sessionFile({ name: undefined }) });
      const sessions = await readSessions();
      expect(sessions[0].name).toBe('pid 111');
    });

    it('marks background false when the pid has no roster entry', async () => {
      withRoster(JSON.stringify({ workers: {} }), { '111.json': sessionFile() });
      const sessions = await readSessions();
      expect(sessions[0].background).toBe(false);
    });

    it('does not fail the whole read when roster.json is malformed', async () => {
      withRoster('{not json', { '111.json': sessionFile() });
      const sessions = await readSessions();
      expect(sessions).toHaveLength(1);
    });
  });
});
