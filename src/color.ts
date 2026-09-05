/** Shared RGB/hex helpers used by both gradient ramps. */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): Rgb {
  const value = Number.parseInt(hex.slice(1), 16);
  return { r: (value >> 16) & 0xff, g: (value >> 8) & 0xff, b: value & 0xff };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const clampChannel = (channel: number) => Math.min(255, Math.max(0, Math.round(channel)));
  return `#${[r, g, b]
    .map((channel) => clampChannel(channel).toString(16).padStart(2, '0'))
    .join('')}`;
}

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

export function lerpRgb(from: Rgb, to: Rgb, t: number): Rgb {
  return { r: lerp(from.r, to.r, t), g: lerp(from.g, to.g, t), b: lerp(from.b, to.b, t) };
}

/** Scales a hex color's brightness by `factor` (0-1) — used for dimmed/empty cells. */
export function dimHex(hex: string, factor: number): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex({ r: r * factor, g: g * factor, b: b * factor });
}
