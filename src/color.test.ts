import { describe, expect, it } from 'vitest';
import { dimHex, hexToRgb, lerp, lerpRgb, rgbToHex } from './color.js';

describe('hexToRgb / rgbToHex', () => {
  it('round-trips a hex color', () => {
    expect(rgbToHex(hexToRgb('#00eaff'))).toBe('#00eaff');
    expect(rgbToHex(hexToRgb('#ff3d81'))).toBe('#ff3d81');
    expect(rgbToHex(hexToRgb('#000000'))).toBe('#000000');
    expect(rgbToHex(hexToRgb('#ffffff'))).toBe('#ffffff');
  });

  it('decodes channels correctly', () => {
    expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb('#00ff00')).toEqual({ r: 0, g: 255, b: 0 });
    expect(hexToRgb('#0000ff')).toEqual({ r: 0, g: 0, b: 255 });
  });

  it('clamps out-of-range channels rather than producing invalid hex', () => {
    expect(rgbToHex({ r: 300, g: -20, b: 128 })).toBe('#ff0080');
  });

  it('rounds fractional channels', () => {
    expect(rgbToHex({ r: 127.6, g: 0, b: 0 })).toBe('#800000');
  });
});

describe('lerp', () => {
  it('interpolates linearly', () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(0, 10, 0.5)).toBe(5);
  });

  it('extrapolates outside [0,1] (callers are responsible for clamping t)', () => {
    expect(lerp(0, 10, 1.5)).toBe(15);
  });
});

describe('lerpRgb', () => {
  it('interpolates each channel independently', () => {
    const from = { r: 0, g: 0, b: 0 };
    const to = { r: 100, g: 200, b: 50 };
    expect(lerpRgb(from, to, 0.5)).toEqual({ r: 50, g: 100, b: 25 });
  });
});

describe('dimHex', () => {
  it('scales brightness toward black', () => {
    expect(dimHex('#ffffff', 0.5)).toBe('#808080');
    expect(dimHex('#ffffff', 0)).toBe('#000000');
    expect(dimHex('#ffffff', 1)).toBe('#ffffff');
  });

  it('preserves hue ratio, not just overall darkness', () => {
    expect(dimHex('#ff0000', 0.25)).toBe('#400000');
  });
});
