import { Box, Text } from 'ink';
import type { SessionActivity, SessionInfo } from '../data/sessions.js';
import { ICON, INACTIVE, MUTED, SESSION_ICON, SUCCESS } from '../theme.js';

const ACTIVITY_COLOR: Record<SessionActivity, string> = {
  working: SUCCESS,
  idle: INACTIVE,
};

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
const ICON_COL = 2; // 1-column dingbat + 1 space, both unambiguous
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
// Ink falls back to a full-terminal clear-and-redraw only when the frame's
// total height reaches the terminal's row count; below that it does an
// incremental erase-and-repaint whose line-count bookkeeping can desync
// between frames of different heights (confirmed by reading ink's own
// source — see git history). The session list is the one part of this
// layout whose row count changes on its own, growing and shrinking with
// however many Claude Code sessions happen to be running. Capping it keeps
// the app's total height from drifting, rather than tracking every fork
// and background agent 1:1.
const MAX_VISIBLE_SESSIONS = 6;

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
  const visible = sessions.slice(0, MAX_VISIBLE_SESSIONS);
  const hiddenCount = sessions.length - visible.length;

  return (
    <Box flexDirection="column">
      <Text bold color={INACTIVE}>
        {ICON.sessions} SESIONES ACTIVAS ({sessions.length})
      </Text>
      {sessions.length === 0 && <Text color={MUTED}>{'  '}ninguna sesión detectada</Text>}
      {visible.map((session) => (
        <Box key={session.pid} marginLeft={INDENT}>
          {/* Literal space here, not Box padding — a real space character always
              advances the cursor by exactly one column, with no dependency on
              Ink's or the terminal's width estimate for the glyph before it. */}
          <Text color={ACTIVITY_COLOR[session.activity]}>{SESSION_ICON[session.activity]} </Text>
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
      {hiddenCount > 0 && (
        <Text color={MUTED}>
          {' '.repeat(INDENT)}+{hiddenCount} más
        </Text>
      )}
    </Box>
  );
}
