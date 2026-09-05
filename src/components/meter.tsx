import { Text } from 'ink';
import { dimHex } from '../color.js';
import { healthColor } from '../health-gradient.js';

interface MeterProps {
  /** 0-100 usage percentage. */
  pct: number;
  width?: number;
}

const EMPTY_DIM_FACTOR = 0.25;

/**
 * Block-bar meter, green → amber → red. Each cell is colored by its own
 * absolute position on the 0-100 scale, not by the current percentage — the
 * cell at position 80% is always red, whether or not the bar has reached
 * there yet. That way the danger zone is visible before you get to it.
 * Empty cells keep the same ramp, dimmed, so the full width always reads.
 */
export function Meter({ pct, width = 20 }: MeterProps) {
  const clamped = Math.min(100, Math.max(0, pct));
  const filled = Math.round((clamped / 100) * width);

  return (
    <Text>
      {Array.from({ length: width }, (_, col) => {
        const cellPct = width <= 1 ? 0 : (col / (width - 1)) * 100;
        const color = healthColor(cellPct);
        const isFilled = col < filled;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length bar, columns never reorder
          <Text key={col} color={isFilled ? color : dimHex(color, EMPTY_DIM_FACTOR)}>
            {isFilled ? '▓' : '░'}
          </Text>
        );
      })}
    </Text>
  );
}
