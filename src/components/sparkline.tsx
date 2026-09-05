import { Text } from 'ink';
import { healthColor } from '../health-gradient.js';

interface SparklineProps {
  /** Usage percentages (0-100), oldest first. */
  values: number[];
  width?: number;
}

const BLOCKS = '▁▂▃▄▅▆▇█';

function blockFor(pct: number): string {
  const clamped = Math.min(100, Math.max(0, pct));
  const index = Math.min(BLOCKS.length - 1, Math.floor((clamped / 100) * BLOCKS.length));
  return BLOCKS[index];
}

/**
 * Compact history of a usage window's percentage over time, one cell per
 * sample, colored by the same green→amber→red ramp as the meter. Takes the
 * most recent `width` samples; returns nothing rather than a misleading flat
 * line when there isn't enough history yet.
 */
export function Sparkline({ values, width = 10 }: SparklineProps) {
  if (values.length < 2) return null;
  const slice = values.slice(-width);

  return (
    <Text>
      {slice.map((pct, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed chronological order, samples never reorder
        <Text key={index} color={healthColor(pct)}>
          {blockFor(pct)}
        </Text>
      ))}
    </Text>
  );
}
