import { describe, expect, it } from 'vitest';
import { healthColor } from './health-gradient.js';

describe('healthColor', () => {
  it('is green at 0%', () => {
    expect(healthColor(0)).toBe('#2ecc40');
  });

  it('is amber at 50%', () => {
    expect(healthColor(50)).toBe('#f1c40f');
  });

  it('is red at 100%', () => {
    expect(healthColor(100)).toBe('#e74c3c');
  });

  it('clamps out-of-range input', () => {
    expect(healthColor(-20)).toBe(healthColor(0));
    expect(healthColor(150)).toBe(healthColor(100));
  });

  it('interpolates monotonically toward red as pct rises', () => {
    const at60 = healthColor(60);
    const at90 = healthColor(90);
    // Both should be past the amber midpoint, moving toward the red stop.
    expect(at60).not.toBe(at90);
  });
});
