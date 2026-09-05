import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';
import { Meter } from './meter.js';

function glyphs(frame: string): string {
  return [...frame].filter((c) => c === '▓' || c === '░').join('');
}

describe('Meter', () => {
  it('renders exactly `width` cells regardless of percentage', () => {
    for (const pct of [0, 1, 47, 50, 99, 100]) {
      const { lastFrame } = render(<Meter pct={pct} width={20} />);
      expect(glyphs(lastFrame() ?? '')).toHaveLength(20);
    }
  });

  it('fills cells proportionally to pct, rounded to the nearest cell', () => {
    const { lastFrame } = render(<Meter pct={50} width={20} />);
    const bar = glyphs(lastFrame() ?? '');
    expect(bar).toBe('▓'.repeat(10) + '░'.repeat(10));
  });

  it('is fully empty at 0% and fully filled at 100%', () => {
    expect(glyphs(render(<Meter pct={0} width={10} />).lastFrame() ?? '')).toBe('░'.repeat(10));
    expect(glyphs(render(<Meter pct={100} width={10} />).lastFrame() ?? '')).toBe('▓'.repeat(10));
  });

  it('clamps out-of-range percentages instead of over/under-filling', () => {
    expect(glyphs(render(<Meter pct={150} width={10} />).lastFrame() ?? '')).toBe('▓'.repeat(10));
    expect(glyphs(render(<Meter pct={-20} width={10} />).lastFrame() ?? '')).toBe('░'.repeat(10));
  });

  it('defaults to a width of 20 when not specified', () => {
    const { lastFrame } = render(<Meter pct={30} />);
    expect(glyphs(lastFrame() ?? '')).toHaveLength(20);
  });
});
