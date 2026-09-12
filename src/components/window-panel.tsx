import { Box, Text } from 'ink';
import type { UsageWindow } from '../data/usage-api.js';
import { resetAt, until } from '../format.js';
import { healthColor } from '../health-gradient.js';
import type { Projection } from '../projection.js';
import { ICON, MUTED, VERDICT_ICON } from '../theme.js';
import { Meter } from './meter.js';
import { Sparkline } from './sparkline.js';

/**
 * Columns reserved for `icon + label` before the meter, shared by every
 * panel so all meters line up. Sized for the widest nested label the weekly
 * group draws ("  🌐 ESTÁNDAR", 13 cols) plus one column of breathing room.
 */
export const LABEL_WIDTH = 14;

interface WindowPanelProps {
  icon: string;
  label: string;
  window: UsageWindow | null;
  sparklineValues?: number[];
  projection?: Projection | null;
  meterWidth?: number;
  sparkWidth?: number;
  compact?: boolean;
}

function formatSlope(perHour: number, isWeekly: boolean): string {
  const value = isWeekly ? perHour * 24 : perHour;
  const unit = isWeekly ? 'd' : 'h';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%/${unit}`;
}

function verdictLabel(projection: Projection): string {
  switch (projection.verdict) {
    case 'exhaustsBeforeReset':
      return 'agotas antes del reset';
    case 'tight':
      return 'ajustado, poco margen';
    default:
      return 'llegas con margen';
  }
}

/** "⏰️ renueva mié 16/09 23:00  -  faltan 4d11h", or null when the reset is unknown. */
export function resetLine(resetsAt: Date | null): string | null {
  const reset = resetAt(resetsAt);
  if (!reset) return null;
  const remaining = until(resetsAt);
  // ASCII '-', not '·' — see app.tsx's top comment for why.
  return `${ICON.resetClock} renueva ${reset}${remaining ? `  -  faltan ${remaining}` : ''}`;
}

interface MeterRowProps {
  icon: string;
  label: string;
  pct: number;
  meterWidth: number;
  /** Columns of indentation inside the label column (nested sections). */
  indent?: number;
}

export function MeterRow({ icon, label, pct, meterWidth, indent = 0 }: MeterRowProps) {
  return (
    <Box>
      <Box width={LABEL_WIDTH}>
        <Text bold>
          {' '.repeat(indent)}
          {icon} {label}
        </Text>
      </Box>
      <Meter pct={pct} width={meterWidth} />
      <Text bold color={healthColor(pct)}>
        {' '}
        {pct.toFixed(0)}%
      </Text>
    </Box>
  );
}

interface TrendRowProps {
  values: number[];
  projection?: Projection | null;
  sparkWidth: number;
  isWeekly: boolean;
  indent?: number;
}

/** Sparkline plus burn rate and verdict. Renders nothing below 2 samples. */
export function TrendRow({ values, projection, sparkWidth, isWeekly, indent = 2 }: TrendRowProps) {
  if (values.length < 2) return null;
  return (
    <Box>
      <Text color={MUTED}>
        {' '.repeat(indent)}
        {ICON.sparkline}{' '}
      </Text>
      <Sparkline values={values} width={sparkWidth} />
      {projection && (
        <Text color={MUTED}>
          {'   '}
          {ICON.burnRate} {formatSlope(projection.slopePerHour, isWeekly)}
          {'   '}
          {VERDICT_ICON[projection.verdict]} {verdictLabel(projection)}
        </Text>
      )}
    </Box>
  );
}

export function isWeeklyLabel(label: string): boolean {
  const lower = label.toLowerCase();
  return lower.includes('semanal') || lower.includes('7d');
}

export function WindowPanel({
  icon,
  label,
  window,
  sparklineValues,
  projection,
  meterWidth = 20,
  sparkWidth = 10,
  compact = false,
}: WindowPanelProps) {
  if (!window) {
    return (
      <Box>
        <Text color={MUTED}>
          {icon} {label}: sin datos
        </Text>
      </Box>
    );
  }

  const reset = resetLine(window.resetsAt);

  return (
    <Box flexDirection="column">
      <MeterRow icon={icon} label={label} pct={window.utilization} meterWidth={meterWidth} />
      {!compact && reset && (
        <Text color={MUTED}>
          {'  '}
          {reset}
        </Text>
      )}
      {!compact && sparklineValues && (
        <TrendRow
          values={sparklineValues}
          projection={projection}
          sparkWidth={sparkWidth}
          isWeekly={isWeeklyLabel(label)}
        />
      )}
    </Box>
  );
}
