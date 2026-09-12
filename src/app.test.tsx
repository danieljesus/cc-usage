import { describe, expect, it } from 'vitest';
import { modelCaps, sharesReset } from './app.js';
import type { ModelScopedWindow, UsageSnapshot } from './data/usage-api.js';
import { ICON } from './theme.js';

function snapshot(overrides: Partial<UsageSnapshot> = {}): UsageSnapshot {
  return {
    fetchedAt: new Date(0),
    subscriptionType: null,
    fiveHour: null,
    sevenDay: null,
    sevenDayOpus: null,
    sevenDaySonnet: null,
    credits: null,
    modelScoped: [],
    ...overrides,
  };
}

function scoped(
  displayName: string,
  group: ModelScopedWindow['group'],
  utilization = 5,
): ModelScopedWindow {
  return { displayName, group, utilization, resetsAt: null };
}

describe('modelCaps', () => {
  it('returns nothing without a snapshot', () => {
    expect(modelCaps(null)).toEqual([]);
  });

  it('labels each cap with the window the API reports it in and keys it for history', () => {
    const caps = modelCaps(
      snapshot({
        modelScoped: [scoped('Fable', 'weekly'), scoped('Fable', 'session'), scoped('Fable', null)],
      }),
    );
    expect(caps.map((c) => c.label)).toEqual(['FABLE 7d', 'FABLE 5h', 'FABLE']);
    expect(caps.map((c) => c.key)).toEqual(['fable:7d', 'fable:5h', 'fable']);
    expect(caps.map((c) => c.name)).toEqual(['FABLE', 'FABLE', 'FABLE']);
    expect(caps.every((c) => c.icon === ICON.fable)).toBe(true);
  });

  it('falls back to the generic model icon for unknown models', () => {
    const [capItem] = modelCaps(snapshot({ modelScoped: [scoped('Haiku', 'weekly')] }));
    expect(capItem.icon).toBe(ICON.model);
    expect(capItem.label).toBe('HAIKU 7d');
  });

  it('lists the legacy Opus/Sonnet weekly caps and skips their duplicate in limits[]', () => {
    const caps = modelCaps(
      snapshot({
        sevenDayOpus: { utilization: 10, resetsAt: null },
        modelScoped: [
          scoped('Opus', 'weekly'),
          scoped('Opus', 'session'),
          scoped('Sonnet', 'weekly'),
        ],
      }),
    );
    expect(caps.map((c) => c.label)).toEqual(['OPUS 7d', 'OPUS 5h', 'SONNET 7d']);
    expect(caps[0].window.utilization).toBe(10);
    expect(caps[0].icon).toBe(ICON.opus);
  });
});

describe('sharesReset', () => {
  const at = (ms: number) => ({ utilization: 0, resetsAt: new Date(ms) });

  it('is true for the same instant and within a minute of slack', () => {
    expect(sharesReset(at(1_000_000), at(1_000_000))).toBe(true);
    expect(sharesReset(at(1_000_000), at(1_059_000))).toBe(true);
  });

  it('is false beyond the tolerance or when either reset is unknown', () => {
    expect(sharesReset(at(1_000_000), at(1_061_000))).toBe(false);
    expect(sharesReset(at(1_000_000), { utilization: 0, resetsAt: null })).toBe(false);
    expect(sharesReset(null, at(1_000_000))).toBe(false);
  });
});
