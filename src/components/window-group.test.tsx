import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';
import type { Projection } from '../projection.js';
import { WindowGroup } from './window-group.js';

const RESETS_AT = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000 + 11 * 60 * 60 * 1000);

function sections(withTrend = false) {
  const projection: Projection = { slopePerHour: 1, etaExhaustion: null, verdict: 'tight' };
  const trend = withTrend ? { sparklineValues: [1, 2, 3], projection } : {};
  return [
    {
      key: 'standard',
      icon: '🌐',
      label: 'ESTÁNDAR',
      window: { utilization: 43, resetsAt: RESETS_AT },
      ...trend,
    },
    {
      key: 'fable:7d',
      icon: '🔮',
      label: 'FABLE',
      window: { utilization: 76, resetsAt: RESETS_AT },
      ...trend,
    },
  ];
}

describe('WindowGroup', () => {
  it('draws the title once, then one nested meter per section', () => {
    const { lastFrame } = render(
      <WindowGroup icon="📅" label="SEMANAL" resetsAt={RESETS_AT} sections={sections()} isWeekly />,
    );
    const lines = (lastFrame() ?? '').split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('SEMANAL');
    expect(lines[1]).toMatch(/^ {2}🌐 ESTÁNDAR.*43%$/);
    expect(lines[2]).toMatch(/^ {2}🔮 FABLE.*76%$/);
  });

  it('shows the shared reset beside the title when it fits', () => {
    const { lastFrame } = render(
      <WindowGroup
        icon="📅"
        label="SEMANAL"
        resetsAt={RESETS_AT}
        sections={sections()}
        isWeekly
        width={100}
      />,
    );
    const lines = (lastFrame() ?? '').split('\n');
    expect(lines[0]).toContain('renueva');
    expect(lines[0]).toContain('faltan 4d1');
    expect((lastFrame() ?? '').match(/renueva/g)).toHaveLength(1);
  });

  it('moves the reset to its own line when the title row is too narrow for it', () => {
    const { lastFrame } = render(
      <WindowGroup
        icon="📅"
        label="SEMANAL"
        resetsAt={RESETS_AT}
        sections={sections()}
        isWeekly
        width={50}
      />,
    );
    const lines = (lastFrame() ?? '').split('\n');
    expect(lines).toHaveLength(4);
    expect(lines[0]).not.toContain('renueva');
    expect(lines[1]).toMatch(/^ {2}.*renueva/);
  });

  it('gives every section its own trend row, indented under its meter, with the weekly slope', () => {
    const { lastFrame } = render(
      <WindowGroup
        icon="📅"
        label="SEMANAL"
        resetsAt={RESETS_AT}
        sections={sections(true)}
        isWeekly
        width={100}
      />,
    );
    const lines = (lastFrame() ?? '').split('\n');
    expect(lines).toHaveLength(5);
    expect(lines[2]).toMatch(/^ {4}📊 /);
    expect(lines[4]).toMatch(/^ {4}📊 /);
    expect((lastFrame() ?? '').match(/\+24\.0%\/d/g)).toHaveLength(2);
    expect((lastFrame() ?? '').match(/ajustado, poco margen/g)).toHaveLength(2);
  });

  it('collapses to title plus meters in compact mode', () => {
    const { lastFrame } = render(
      <WindowGroup
        icon="📅"
        label="SEMANAL"
        resetsAt={RESETS_AT}
        sections={sections(true)}
        isWeekly
        compact
        width={100}
      />,
    );
    const frame = lastFrame() ?? '';
    expect(frame.split('\n')).toHaveLength(3);
    expect(frame).not.toContain('renueva');
    expect(frame).not.toContain('📊');
  });
});
