import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ClaudeCredentials } from './credentials.js';
import { fetchUsage } from './usage-api.js';

const CREDS: ClaudeCredentials = { accessToken: 'tok_123', subscriptionType: 'pro' };

function mockFetch(response: { ok: boolean; json?: () => unknown }) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: response.ok,
      json: response.json ?? (() => ({})),
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchUsage', () => {
  it('parses the real confirmed response shape (top-level fields, no rate_limits wrapper)', async () => {
    mockFetch({
      ok: true,
      json: () => ({
        five_hour: { utilization: 19, resets_at: '2026-09-05T15:59:59.820Z' },
        seven_day: { utilization: 2, resets_at: '2026-09-09T20:59:59.820Z' },
        seven_day_opus: null,
        seven_day_sonnet: null,
        extra_usage: { is_enabled: false },
        limits: [
          { kind: 'session', group: 'session', percent: 19, scope: null },
          {
            kind: 'weekly_scoped',
            group: 'weekly',
            percent: 5,
            resets_at: '2026-09-09T20:59:59.820Z',
            scope: { model: { id: null, display_name: 'Fable' }, surface: null },
          },
        ],
      }),
    });

    const result = await fetchUsage(CREDS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.snapshot.fiveHour).toEqual({
      utilization: 19,
      resetsAt: new Date('2026-09-05T15:59:59.820Z'),
    });
    expect(result.snapshot.sevenDay?.utilization).toBe(2);
    expect(result.snapshot.sevenDayOpus).toBeNull();
    expect(result.snapshot.credits).toBeNull();
    expect(result.snapshot.modelScoped).toEqual([
      {
        displayName: 'Fable',
        group: 'weekly',
        utilization: 5,
        resetsAt: new Date('2026-09-09T20:59:59.820Z'),
      },
    ]);
  });

  it('sends the bearer token and JSON content-type header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => ({ five_hour: null }) });
    vi.stubGlobal('fetch', fetchMock);

    await fetchUsage(CREDS);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/oauth/usage'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer tok_123',
          'Content-Type': 'application/json',
        }),
      }),
    );
  });

  it('accepts resets_at as epoch seconds defensively', async () => {
    mockFetch({
      ok: true,
      json: () => ({ five_hour: { utilization: 50, resets_at: 1788600000 } }),
    });
    const result = await fetchUsage(CREDS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.fiveHour?.resetsAt).toEqual(new Date(1788600000 * 1000));
  });

  it('clamps utilization to 0-100', async () => {
    mockFetch({ ok: true, json: () => ({ five_hour: { utilization: 150, resets_at: null } }) });
    const result = await fetchUsage(CREDS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.fiveHour?.utilization).toBe(100);
  });

  it('treats a window with a non-numeric utilization as absent rather than crashing', async () => {
    mockFetch({ ok: true, json: () => ({ five_hour: { utilization: 'lots', resets_at: null } }) });
    const result = await fetchUsage(CREDS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.fiveHour).toBeNull();
  });

  it('only surfaces credits when the server marks them enabled', async () => {
    mockFetch({
      ok: true,
      json: () => ({
        extra_usage: {
          is_enabled: true,
          utilization: 15,
          monthly_limit: 2000,
          used_credits: 300,
          currency: 'EUR',
        },
      }),
    });
    const result = await fetchUsage(CREDS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.credits).toEqual({
      utilization: 15,
      resetsAt: null,
      monthlyLimit: 2000,
      usedCredits: 300,
      currency: 'EUR',
    });
  });

  it('drops modelScoped entries missing a display name or percent', async () => {
    mockFetch({
      ok: true,
      json: () => ({
        limits: [
          { percent: 10, scope: { model: {} } }, // no display_name
          { scope: { model: { display_name: 'Sonnet' } } }, // no percent
          { percent: 5, scope: { model: { display_name: 'Opus' } } }, // valid
        ],
      }),
    });
    const result = await fetchUsage(CREDS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.modelScoped).toEqual([
      { displayName: 'Opus', group: null, utilization: 5, resetsAt: null },
    ]);
  });

  it('keeps the limit group only when it is one of the known windows', async () => {
    mockFetch({
      ok: true,
      json: () => ({
        limits: [
          { group: 'session', percent: 1, scope: { model: { display_name: 'A' } } },
          { group: 'weekly', percent: 2, scope: { model: { display_name: 'B' } } },
          { group: 'monthly', percent: 3, scope: { model: { display_name: 'C' } } },
        ],
      }),
    });
    const result = await fetchUsage(CREDS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.modelScoped.map((m) => [m.displayName, m.group])).toEqual([
      ['A', 'session'],
      ['B', 'weekly'],
      ['C', null],
    ]);
  });

  it('reports http-error on a non-ok response', async () => {
    mockFetch({ ok: false });
    const result = await fetchUsage(CREDS);
    expect(result).toEqual({ ok: false, reason: 'http-error' });
  });

  it('reports network-error when fetch itself throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNRESET')));
    const result = await fetchUsage(CREDS);
    expect(result).toEqual({ ok: false, reason: 'network-error' });
  });

  it('reports network-error when the body is not valid JSON (json() throws)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => {
          throw new SyntaxError('Unexpected token');
        },
      }),
    );
    const result = await fetchUsage(CREDS);
    expect(result).toEqual({ ok: false, reason: 'network-error' });
  });
});
