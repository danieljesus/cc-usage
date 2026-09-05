import { Box, Text } from 'ink';
import type { SessionInfo } from '../data/sessions.js';
import { ICON, INACTIVE, MUTED, SESSION_ICON } from '../theme.js';

interface SessionsPanelProps {
  sessions: SessionInfo[];
  /** Available content width in columns, so rows never overflow the box. */
  width: number;
}

// Matches the 2-space indent every sub-row elsewhere in the app uses to read
// as nested under its header (WindowPanel's "renueva"/sparkline lines under
// "5 HORAS") — these rows were missing it, starting flush with the
// "SESIONES ACTIVAS" header above them instead of nested under it.
const INDENT = 2;
const ICON_COL = 3; // 2-cell emoji + 1 space
const AGE_COL = 4;
const GAP = 1;
// Every other row in the app has natural slack below the box's width. This
// one didn't — nameWidth + cwdWidth was sized to sum to exactly what's left,
// so the row's total landed on precisely `width` with zero margin. That's
// fragile: the same class of bug that produced the redraw "staircase"
// elsewhere (a row exactly as wide as its container, one glyph-width
// surprise away from tipping over) but self-inflicted here rather than
// caused by an ambiguous-width emoji. Reserve a couple of columns so this
// row is never flush with the edge.
const ROW_MARGIN = 2;

function minutesAgo(updatedAt: Date): string {
  const mins = Math.max(0, Math.floor((Date.now() - updatedAt.getTime()) / 60000));
  return mins === 0 ? '<1m' : `${mins}m`;
}

export function SessionsPanel({ sessions, width }: SessionsPanelProps) {
  // Name gets a third of what's left after the icon and age columns, cwd gets
  // the rest — and is dropped below a minimum, rather than rendered at zero
  // width, once the terminal is too narrow for both.
  const remaining = Math.max(0, width - INDENT - ICON_COL - AGE_COL - GAP * 2 - ROW_MARGIN);
  const nameWidth = Math.max(8, Math.floor(remaining / 3));
  const cwdWidth = remaining - nameWidth;
  const showCwd = cwdWidth >= 10;

  return (
    <Box flexDirection="column">
      <Text bold color={INACTIVE}>
        {ICON.sessions} SESIONES ACTIVAS ({sessions.length})
      </Text>
      {sessions.length === 0 && <Text color={MUTED}>{'  '}ninguna sesión detectada</Text>}
      {sessions.map((session) => (
        <Box key={session.pid} marginLeft={INDENT}>
          <Box width={ICON_COL}>
            <Text>{SESSION_ICON[session.activity]}</Text>
          </Box>
          <Box width={nameWidth} marginRight={GAP}>
            <Text wrap="truncate-end">{session.name}</Text>
          </Box>
          {showCwd && (
            <Box width={cwdWidth} marginRight={GAP}>
              <Text color={MUTED} wrap="truncate-end">
                {session.cwd}
              </Text>
            </Box>
          )}
          <Box width={AGE_COL} justifyContent="flex-end">
            <Text color={MUTED}>{minutesAgo(session.updatedAt)}</Text>
          </Box>
        </Box>
      ))}
    </Box>
  );
}
