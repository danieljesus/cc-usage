import { Box, Text } from 'ink';
import stringWidth from 'string-width';
import type { UsageWindow } from '../data/usage-api.js';
import type { Projection } from '../projection.js';
import { MUTED } from '../theme.js';
import { LABEL_WIDTH, MeterRow, resetLine, TrendRow } from './window-panel.js';

export interface GroupSection {
  key: string;
  icon: string;
  label: string;
  window: UsageWindow;
  sparklineValues?: number[];
  projection?: Projection | null;
}

interface WindowGroupProps {
  icon: string;
  label: string;
  /** Shared by every section — that's what makes them one group. */
  resetsAt: Date | null;
  sections: GroupSection[];
  isWeekly: boolean;
  meterWidth?: number;
  sparkWidth?: number;
  compact?: boolean;
  /** Content columns available; decides whether the reset line fits beside the title. */
  width?: number;
}

/**
 * Several usage windows that renew at the same instant, drawn as one titled
 * block: the shared reset line once, then a nested meter (plus trend, when
 * not compact) per section. The weekly panel uses it to show the standard
 * cap and each per-model cap (Fable...) side by side instead of repeating
 * the same renewal time under each.
 */
export function WindowGroup({
  icon,
  label,
  resetsAt,
  sections,
  isWeekly,
  meterWidth = 20,
  sparkWidth = 10,
  compact = false,
  width,
}: WindowGroupProps) {
  const reset = compact ? null : resetLine(resetsAt);
  // Beside the title when it fits without wrapping; on its own line below
  // otherwise — a wrapped row is exactly what desyncs Ink's redraw math.
  const inlineReset =
    reset !== null && (width === undefined || LABEL_WIDTH + stringWidth(reset) <= width);

  return (
    <Box flexDirection="column">
      <Box>
        <Box width={LABEL_WIDTH}>
          <Text bold>
            {icon} {label}
          </Text>
        </Box>
        {reset && inlineReset && <Text color={MUTED}>{reset}</Text>}
      </Box>
      {reset && !inlineReset && (
        <Text color={MUTED}>
          {'  '}
          {reset}
        </Text>
      )}
      {sections.map((section) => (
        <Box key={section.key} flexDirection="column">
          <MeterRow
            icon={section.icon}
            label={section.label}
            pct={section.window.utilization}
            meterWidth={meterWidth}
            indent={2}
          />
          {!compact && section.sparklineValues && (
            <TrendRow
              values={section.sparklineValues}
              projection={section.projection}
              sparkWidth={sparkWidth}
              isWeekly={isWeekly}
              indent={4}
            />
          )}
        </Box>
      ))}
    </Box>
  );
}
