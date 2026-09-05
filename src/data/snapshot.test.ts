import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', () => ({ readFile: vi.fn() }));

import { readFile } from 'node:fs/promises';
import { readSnapshot } from './snapshot.js';

beforeEach(() => {
  vi.mocked(readFile).mockReset();
});

describe('readSnapshot', () => {
  it('parses a well-formed statusline snapshot', async () => {
    vi.mocked(readFile).mockResolvedValue(
      JSON.stringify({
        ts: 1788608261,
        rate_limits: {
          five_hour: { used_percentage: 42.5, resets_at: 1788606698 },
          seven_day: { used_percentage: 17.3, resets_at: 1789132800 },
        },
      }),
    );

    const snapshot = await readSnapshot();

    expect(snapshot?.fetchedAt).toEqual(new Date(1788608261 * 1000));
    expect(snapshot?.fiveHour).toEqual({
      utilization: 42.5,
      resetsAt: new Date(1788606698 * 1000),
    });
    expect(snapshot?.sevenDay).toEqual({
      utilization: 17.3,
      resetsAt: new Date(1789132800 * 1000),
    });
  });

  it('returns a window with a null resetsAt when resets_at is missing', async () => {
    vi.mocked(readFile).mockResolvedValue(
      JSON.stringify({ ts: 1000, rate_limits: { five_hour: { used_percentage: 10 } } }),
    );
    const snapshot = await readSnapshot();
    expect(snapshot?.fiveHour).toEqual({ utilization: 10, resetsAt: null });
  });

  it('returns null windows when rate_limits is absent', async () => {
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ ts: 1000 }));
    const snapshot = await readSnapshot();
    expect(snapshot).toEqual({ fetchedAt: new Date(1000 * 1000), fiveHour: null, sevenDay: null });
  });

  it('returns null when ts is missing', async () => {
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ rate_limits: {} }));
    expect(await readSnapshot()).toBeNull();
  });

  it('returns null when the file does not exist', async () => {
    vi.mocked(readFile).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    expect(await readSnapshot()).toBeNull();
  });

  it('returns null on malformed JSON (e.g. a concurrent partial write)', async () => {
    vi.mocked(readFile).mockResolvedValue('{"ts": 1000, "rate_limi');
    expect(await readSnapshot()).toBeNull();
  });

  it('treats a non-numeric used_percentage as an absent window', async () => {
    vi.mocked(readFile).mockResolvedValue(
      JSON.stringify({ ts: 1000, rate_limits: { five_hour: { used_percentage: 'lots' } } }),
    );
    const snapshot = await readSnapshot();
    expect(snapshot?.fiveHour).toBeNull();
  });
});
