import { Box, Text } from 'ink';
import type { SessionInfo } from '../data/sessions.js';
import { ICON, INACTIVE, MUTED, SESSION_ICON } from '../theme.js';

interface SessionsPanelProps {
  sessions: SessionInfo[];
}

function minutesAgo(updatedAt: Date): string {
  const mins = Math.max(0, Math.floor((Date.now() - updatedAt.getTime()) / 60000));
  return mins === 0 ? '<1m' : `${mins}m`;
}

export function SessionsPanel({ sessions }: SessionsPanelProps) {
  return (
    <Box flexDirection="column">
      <Text bold color={INACTIVE}>
        {ICON.sessions} SESIONES ACTIVAS ({sessions.length})
      </Text>
      {sessions.length === 0 && <Text color={MUTED}> ninguna sesión detectada</Text>}
      {sessions.map((session) => (
        <Box key={session.pid}>
          <Text> {SESSION_ICON[session.activity]} </Text>
          <Box width={28}>
            <Text wrap="truncate-end">{session.name}</Text>
          </Box>
          <Box width={30}>
            <Text color={MUTED} wrap="truncate-end">
              {session.cwd}
            </Text>
          </Box>
          <Text color={MUTED}>{minutesAgo(session.updatedAt)}</Text>
        </Box>
      ))}
    </Box>
  );
}
