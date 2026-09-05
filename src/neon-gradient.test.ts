import { describe, expect, it } from 'vitest';
import { neonGradientColor } from './neon-gradient.js';

describe('neonGradientColor', () => {
  it('starts and ends on the ramp stops', () => {
    expect(neonGradientColor(0)).toBe('#00eaff');
    expect(neonGradientColor(1)).toBe('#ff3d81');
  });

  it('clamps out-of-range input to the nearest end stop', () => {
    expect(neonGradientColor(-5)).toBe(neonGradientColor(0));
    expect(neonGradientColor(5)).toBe(neonGradientColor(1));
  });

  it('passes through the middle stops at their exact segment boundaries', () => {
    // 4 stops -> 3 equal segments, so t=1/3 and t=2/3 land exactly on stops 1 and 2.
    expect(neonGradientColor(1 / 3)).toBe('#7a5cff');
    expect(neonGradientColor(2 / 3)).toBe('#ff2bd6');
  });

  it('is monotonic in each color channel across a segment', () => {
    // Segment 0 (cyan -> violet): red channel rises, green falls.
    const early = neonGradientColor(0.05);
    const late = neonGradientColor(0.3);
    expect(early).not.toBe(late);
  });
});
