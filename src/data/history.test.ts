import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  appendFile: vi.fn(),
}));

// history.ts keeps a module-level "last appended" singleton to dedup writes.
// vi.resetModules() + a fresh dynamic import gives each test a clean instance
// of that state instead of leaking across tests.
async function freshHistoryModule() {
  vi.resetModules();
  const fsp = await import('node:fs/promises');
  const history = await import('./history.js');
  return { fsp, history };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('appendIfChanged', () => {
  it('appends the first point', async () => {
    const { fsp, history } = await freshHistoryModule();
    await history.appendIfChanged({ ts: 1000, fiveHour: 10, sevenDay: 1 });
    expect(fsp.appendFile).toHaveBeenCalledTimes(1);
    expect(fsp.appendFile).toHaveBeenCalledWith(
      expect.any(String),
      `${JSON.stringify({ ts: 1000, fiveHour: 10, sevenDay: 1 })}\n`,
      'utf-8',
    );
  });

  it('does not append a consecutive point with identical values', async () => {
    const { fsp, history } = await freshHistoryModule();
    await history.appendIfChanged({ ts: 1000, fiveHour: 10, sevenDay: 1 });
    await history.appendIfChanged({ ts: 2000, fiveHour: 10, sevenDay: 1 });
    expect(fsp.appendFile).toHaveBeenCalledTimes(1);
  });

  it('appends again once a value actually changes', async () => {
    const { fsp, history } = await freshHistoryModule();
    await history.appendIfChanged({ ts: 1000, fiveHour: 10, sevenDay: 1 });
    await history.appendIfChanged({ ts: 2000, fiveHour: 11, sevenDay: 1 });
    expect(fsp.appendFile).toHaveBeenCalledTimes(2);
  });

  it('appends again when only a per-model cap changes', async () => {
    const { fsp, history } = await freshHistoryModule();
    await history.appendIfChanged({
      ts: 1000,
      fiveHour: 10,
      sevenDay: 1,
      models: { 'fable:7d': 70 },
    });
    await history.appendIfChanged({
      ts: 2000,
      fiveHour: 10,
      sevenDay: 1,
      models: { 'fable:7d': 70 },
    });
    await history.appendIfChanged({
      ts: 3000,
      fiveHour: 10,
      sevenDay: 1,
      models: { 'fable:7d': 71 },
    });
    expect(fsp.appendFile).toHaveBeenCalledTimes(2);
    expect(fsp.appendFile).toHaveBeenLastCalledWith(
      expect.any(String),
      `${JSON.stringify({ ts: 3000, fiveHour: 10, sevenDay: 1, models: { 'fable:7d': 71 } })}\n`,
      'utf-8',
    );
  });

  it('treats a missing models map and an empty one as the same reading', async () => {
    const { fsp, history } = await freshHistoryModule();
    await history.appendIfChanged({ ts: 1000, fiveHour: 10, sevenDay: 1 });
    await history.appendIfChanged({ ts: 2000, fiveHour: 10, sevenDay: 1, models: {} });
    expect(fsp.appendFile).toHaveBeenCalledTimes(1);
  });

  it('swallows a write failure rather than throwing', async () => {
    const { fsp, history } = await freshHistoryModule();
    vi.mocked(fsp.appendFile).mockRejectedValueOnce(new Error('ENOSPC'));
    await expect(
      history.appendIfChanged({ ts: 1000, fiveHour: 10, sevenDay: 1 }),
    ).resolves.toBeUndefined();
  });
});

describe('readHistory', () => {
  it('parses well-formed JSONL', async () => {
    const { fsp, history } = await freshHistoryModule();
    vi.mocked(fsp.readFile).mockResolvedValue(
      '{"ts":1000,"fiveHour":10,"sevenDay":1}\n{"ts":2000,"fiveHour":11,"sevenDay":1}\n',
    );
    const points = await history.readHistory();
    expect(points).toEqual([
      { ts: 1000, fiveHour: 10, sevenDay: 1 },
      { ts: 2000, fiveHour: 11, sevenDay: 1 },
    ]);
  });

  it('keeps per-model caps and drops non-numeric entries from them', async () => {
    const { fsp, history } = await freshHistoryModule();
    vi.mocked(fsp.readFile).mockResolvedValue(
      '{"ts":1000,"fiveHour":10,"sevenDay":1,"models":{"fable:7d":70,"bogus":"x"}}\n{"ts":2000,"fiveHour":11,"sevenDay":1,"models":{}}\n',
    );
    const points = await history.readHistory();
    expect(points).toEqual([
      { ts: 1000, fiveHour: 10, sevenDay: 1, models: { 'fable:7d': 70 } },
      { ts: 2000, fiveHour: 11, sevenDay: 1 },
    ]);
  });

  it('skips malformed lines instead of failing the whole read', async () => {
    const { fsp, history } = await freshHistoryModule();
    vi.mocked(fsp.readFile).mockResolvedValue(
      '{"ts":1000,"fiveHour":10,"sevenDay":1}\nnot json at all\n{"ts":2000,"fiveHour":11,"sevenDay":null}\n',
    );
    const points = await history.readHistory();
    expect(points).toEqual([
      { ts: 1000, fiveHour: 10, sevenDay: 1 },
      { ts: 2000, fiveHour: 11, sevenDay: null },
    ]);
  });

  it('drops lines missing a numeric ts', async () => {
    const { fsp, history } = await freshHistoryModule();
    vi.mocked(fsp.readFile).mockResolvedValue('{"fiveHour":10,"sevenDay":1}\n');
    expect(await history.readHistory()).toEqual([]);
  });

  it('returns an empty array when the file does not exist', async () => {
    const { fsp, history } = await freshHistoryModule();
    vi.mocked(fsp.readFile).mockRejectedValue(
      Object.assign(new Error('ENOENT'), { code: 'ENOENT' }),
    );
    expect(await history.readHistory()).toEqual([]);
  });
});

describe('pruneOnStartup', () => {
  const NOW = 10 * 24 * 60 * 60 * 1000; // day 10, in ms
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('drops points older than 7 days and rewrites the file', async () => {
    const { fsp, history } = await freshHistoryModule();
    const old = { ts: NOW - SEVEN_DAYS_MS - 1000, fiveHour: 5, sevenDay: 1 };
    const recent = { ts: NOW - 1000, fiveHour: 20, sevenDay: 2 };
    vi.mocked(fsp.readFile).mockResolvedValue(
      `${JSON.stringify(old)}\n${JSON.stringify(recent)}\n`,
    );

    const kept = await history.pruneOnStartup();

    expect(kept).toEqual([recent]);
    expect(fsp.writeFile).toHaveBeenCalledWith(
      expect.any(String),
      `${JSON.stringify(recent)}\n`,
      'utf-8',
    );
  });

  it('does not rewrite the file when nothing needs pruning', async () => {
    const { fsp, history } = await freshHistoryModule();
    const recent = { ts: NOW - 1000, fiveHour: 20, sevenDay: 2 };
    vi.mocked(fsp.readFile).mockResolvedValue(`${JSON.stringify(recent)}\n`);

    await history.pruneOnStartup();

    expect(fsp.writeFile).not.toHaveBeenCalled();
  });

  it('seeds the dedup state from the last kept point', async () => {
    const { fsp, history } = await freshHistoryModule();
    const last = { ts: NOW - 1000, fiveHour: 42, sevenDay: 7 };
    vi.mocked(fsp.readFile).mockResolvedValue(`${JSON.stringify(last)}\n`);

    await history.pruneOnStartup();
    // A point with the same values right after startup should be deduped,
    // proving pruneOnStartup seeded lastAppended from history rather than
    // leaving it null.
    await history.appendIfChanged({ ts: NOW, fiveHour: 42, sevenDay: 7 });

    expect(fsp.appendFile).not.toHaveBeenCalled();
  });
});
