/**
 * Continuous cyberpunk neon gradient (electric cyan → violet → magenta →
 * hot pink), copied from arch-terminal's wordmark ramp. Decorative only —
 * used for chrome (borders, titles), never for anything that encodes a
 * value. See health-gradient.ts for the meter fill, which does.
 */
import { dimHex, hexToRgb, lerp, type Rgb, rgbToHex } from './color.js';

const STOPS: Rgb[] = ['#00eaff', '#7a5cff', '#ff2bd6', '#ff3d81'].map(hexToRgb);

/** Maps t in [0, 1] to a hex color along the neon gradient, clamping out-of-range input. */
export function neonGradientColor(t: number): string {
  const clamped = Math.min(1, Math.max(0, t));
  const segment = clamped * (STOPS.length - 1);
  const index = Math.min(STOPS.length - 2, Math.floor(segment));
  const localT = segment - index;
  const from = STOPS[index];
  const to = STOPS[index + 1];

  return rgbToHex({
    r: lerp(from.r, to.r, localT),
    g: lerp(from.g, to.g, localT),
    b: lerp(from.b, to.b, localT),
  });
}

export { dimHex };
