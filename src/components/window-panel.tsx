import { Box, Text } from 'ink';
import type { UsageWindow } from '../data/usage-api.js';
import { resetAt, until } from '../format.js';
import { healthColor } from '../health-gradient.js';
import type { Projection } from '../projection.js';
import { ICON, MUTED, VERDICT_ICON } from '../theme.js';
import { Meter } from './meter.js';
import { Sparkline } from './sparkline.js';

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

  const pct = window.utilization;
  const reset = resetAt(window.resetsAt);
  const remaining = until(window.resetsAt);
  const isWeekly = label.toLowerCase().includes('semanal') || label.toLowerCase().includes('7d');

  return (
    <Box flexDirection="column">
      <Box>
        <Box width={13}>
          <Text bold>
            {icon} {label}
          </Text>
        </Box>
        <Meter pct={pct} width={meterWidth} />
        <Text bold color={healthColor(pct)}>
          {' '}
          {pct.toFixed(0)}%
        </Text>
      </Box>
      {!compact && reset && (
        <Text color={MUTED}>
          {'  '}
          {ICON.resetClock} renueva {reset}
          {remaining ? `  ·  faltan ${remaining}` : ''}
        </Text>
      )}
      {!compact && sparklineValues && sparklineValues.length >= 2 && (
        <Box>
          <Text color={MUTED}>
            {'  '}
            {ICON.sparkline}{' '}
          </Text>
          <Sparkline values={sparklineValues} width={sparkWidth} />
          {projection && (
            <Text color={MUTED}>
              {'   '}
              {ICON.burnRate} {formatSlope(projection.slopePerHour, isWeekly)}
              {'   '}
              {VERDICT_ICON[projection.verdict]} {verdictLabel(projection)}
            </Text>
          )}
        </Box>
      )}
    </Box>
  );
}
