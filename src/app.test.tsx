import { describe, expect, it } from 'vitest';
import { scopedPanels } from './app.js';
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

describe('scopedPanels', () => {
  it('returns nothing without a snapshot', () => {
    expect(scopedPanels(null)).toEqual([]);
  });

  it('labels the panel with the window the API reports the cap in', () => {
    const panels = scopedPanels(
      snapshot({
        modelScoped: [scoped('Fable', 'weekly'), scoped('Fable', 'session'), scoped('Fable', null)],
      }),
    );
    expect(panels.map((p) => p.label)).toEqual(['FABLE 7d', 'FABLE 5h', 'FABLE']);
    expect(panels.every((p) => p.icon === ICON.fable)).toBe(true);
  });

  it('falls back to the generic model icon for unknown models', () => {
    const [panel] = scopedPanels(snapshot({ modelScoped: [scoped('Haiku', 'weekly')] }));
    expect(panel.icon).toBe(ICON.model);
    expect(panel.label).toBe('HAIKU 7d');
  });

  it('skips a weekly Opus/Sonnet cap already rendered from the legacy top-level field', () => {
    const panels = scopedPanels(
      snapshot({
        sevenDayOpus: { utilization: 10, resetsAt: null },
        modelScoped: [
          scoped('Opus', 'weekly'),
          scoped('Opus', 'session'),
          scoped('Sonnet', 'weekly'),
        ],
      }),
    );
    expect(panels.map((p) => p.label)).toEqual(['OPUS 5h', 'SONNET 7d']);
  });
});
