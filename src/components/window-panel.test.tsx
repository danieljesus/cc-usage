import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';
import type { Projection } from '../projection.js';
import { WindowPanel } from './window-panel.js';

describe('WindowPanel', () => {
  it('shows a "sin datos" placeholder when there is no window', () => {
    const { lastFrame } = render(<WindowPanel icon="⏳" label="5 HORAS" window={null} />);
    expect(lastFrame()).toContain('sin datos');
  });

  it('shows the percentage and label', () => {
    const { lastFrame } = render(
      <WindowPanel icon="⏳" label="5 HORAS" window={{ utilization: 47, resetsAt: null }} />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('5 HORAS');
    expect(frame).toContain('47%');
  });

  it('shows reset time and countdown when resetsAt is known', () => {
    const resetsAt = new Date(Date.now() + 90 * 60 * 1000); // 1h30m out
    const { lastFrame } = render(
      <WindowPanel icon="⏳" label="5 HORAS" window={{ utilization: 10, resetsAt }} />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('renueva');
    expect(frame).toContain('faltan');
  });

  it('omits reset/sparkline detail lines in compact mode', () => {
    const resetsAt = new Date(Date.now() + 90 * 60 * 1000);
    const { lastFrame } = render(
      <WindowPanel
        icon="⏳"
        label="5 HORAS"
        window={{ utilization: 10, resetsAt }}
        sparklineValues={[1, 2, 3]}
        compact
      />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).not.toContain('renueva');
    expect(frame.split('\n')).toHaveLength(1);
  });

  it('omits the sparkline line when fewer than 2 samples are available', () => {
    const { lastFrame } = render(
      <WindowPanel
        icon="⏳"
        label="5 HORAS"
        window={{ utilization: 10, resetsAt: null }}
        sparklineValues={[42]}
      />,
    );
    expect(lastFrame() ?? '').not.toContain('📊');
  });

  it('shows the burn rate and verdict only alongside a real projection', () => {
    const withoutProjection = render(
      <WindowPanel
        icon="⏳"
        label="5 HORAS"
        window={{ utilization: 10, resetsAt: null }}
        sparklineValues={[1, 2, 3]}
        projection={null}
      />,
    );
    expect(withoutProjection.lastFrame() ?? '').not.toContain('%/h');

    const projection: Projection = {
      slopePerHour: 2.5,
      etaExhaustion: null,
      verdict: 'comfortable',
    };
    const withProjection = render(
      <WindowPanel
        icon="⏳"
        label="5 HORAS"
        window={{ utilization: 10, resetsAt: null }}
        sparklineValues={[1, 2, 3]}
        projection={projection}
      />,
    );
    const frame = withProjection.lastFrame() ?? '';
    expect(frame).toContain('+2.5%/h');
    expect(frame).toContain('llegas con margen');
  });

  it('formats the weekly slope in %/day instead of %/hour', () => {
    const projection: Projection = { slopePerHour: 1, etaExhaustion: null, verdict: 'comfortable' };
    const { lastFrame } = render(
      <WindowPanel
        icon="📅"
        label="SEMANAL"
        window={{ utilization: 10, resetsAt: null }}
        sparklineValues={[1, 2, 3]}
        projection={projection}
      />,
    );
    // 1%/hour -> 24%/day for a weekly window.
    expect(lastFrame() ?? '').toContain('+24.0%/d');
  });

  it.each([
    ['exhaustsBeforeReset', 'agotas antes del reset'],
    ['tight', 'ajustado, poco margen'],
    ['comfortable', 'llegas con margen'],
  ] as const)('renders the %s verdict label', (verdict, label) => {
    const projection: Projection = { slopePerHour: 1, etaExhaustion: null, verdict };
    const { lastFrame } = render(
      <WindowPanel
        icon="⏳"
        label="5 HORAS"
        window={{ utilization: 10, resetsAt: null }}
        sparklineValues={[1, 2, 3]}
        projection={projection}
      />,
    );
    expect(lastFrame() ?? '').toContain(label);
  });
});
