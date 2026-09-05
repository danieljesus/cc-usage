/**
 * Green → amber → red ramp for anything that encodes "how much of a quota is
 * used" — the same three stops as the old statusline's three-step version,
 * interpolated continuously instead of jumping at 50%/100%.
 */
import { type Rgb, hexToRgb, lerpRgb, rgbToHex } from './color.js';

const STOPS: { at: number; color: Rgb }[] = [
  { at: 0, color: hexToRgb('#2ecc40') },
  { at: 50, color: hexToRgb('#f1c40f') },
  { at: 100, color: hexToRgb('#e74c3c') },
];

/** Maps a 0-100 usage percentage to a hex color along the green→amber→red ramp. */
export function healthColor(pct: number): string {
  const clamped = Math.min(100, Math.max(0, pct));
  for (let i = 0; i < STOPS.length - 1; i++) {
    const from = STOPS[i];
    const to = STOPS[i + 1];
    if (clamped >= from.at && clamped <= to.at) {
      const t = (clamped - from.at) / (to.at - from.at);
      return rgbToHex(lerpRgb(from.color, to.color, t));
    }
  }
  return rgbToHex(STOPS[STOPS.length - 1].color);
}
