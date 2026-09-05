import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';
import { Sparkline } from './sparkline.js';

describe('Sparkline', () => {
  it('renders nothing with fewer than 2 values (would misleadingly imply a trend)', () => {
    expect(render(<Sparkline values={[]} />).lastFrame()).toBe('');
    expect(render(<Sparkline values={[50]} />).lastFrame()).toBe('');
  });

  it('renders one glyph per value, up to `width`', () => {
    const { lastFrame } = render(<Sparkline values={[10, 20, 30]} width={10} />);
    expect([...(lastFrame() ?? '')]).toHaveLength(3);
  });

  it('takes only the most recent `width` values when there are more', () => {
    const values = Array.from({ length: 20 }, (_, i) => i);
    const { lastFrame } = render(<Sparkline values={values} width={5} />);
    expect([...(lastFrame() ?? '')]).toHaveLength(5);
  });

  it('maps 0% to the shortest block and 100% to the tallest', () => {
    const { lastFrame: low } = render(<Sparkline values={[0, 0]} />);
    const { lastFrame: high } = render(<Sparkline values={[100, 100]} />);
    expect(low()).toBe('▁▁');
    expect(high()).toBe('██');
  });

  it('clamps out-of-range values instead of crashing on an invalid index', () => {
    const { lastFrame } = render(<Sparkline values={[-50, 500]} />);
    expect(lastFrame()).toBe('▁█');
  });
});
