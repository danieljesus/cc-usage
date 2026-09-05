import { Box, Text, useApp, useInput, useStdout } from 'ink';
import { useEffect, useState } from 'react';
import { GradientBox } from './components/gradient-box.js';
import { GradientText } from './components/gradient-text.js';
import { SessionsPanel } from './components/sessions-panel.js';
import { WindowPanel } from './components/window-panel.js';
import { readCredentials } from './data/credentials.js';
import { type HistoryPoint, appendIfChanged, pruneOnStartup } from './data/history.js';
import { type SessionInfo, readSessions } from './data/sessions.js';
import { readSnapshot } from './data/snapshot.js';
import { type UsageSnapshot, fetchUsage } from './data/usage-api.js';
import { age } from './format.js';
import { project } from './projection.js';
import { ICON, MUTED, STATUS_ICON } from './theme.js';

const POLL_MS = 30_000;
const TICK_MS = 1_000;
const FIVE_HOUR_MS = 5 * 60 * 60 * 1000;
const SEVEN_DAY_MS = 7 * 24 * 60 * 60 * 1000;

type Freshness = 'live' | 'stale' | 'offline';

function freshnessFor(fetchedAt: Date | null): Freshness {
  if (!fetchedAt) return 'offline';
  const ms = Date.now() - fetchedAt.getTime();
  if (ms < 2 * POLL_MS) return 'live';
  if (ms < 5 * 60_000) return 'stale';
  return 'offline';
}

function seriesFor(points: HistoryPoint[], pick: (p: HistoryPoint) => number | null): number[] {
  return points.map(pick).filter((v): v is number => v !== null);
}

export function App() {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const width = Math.min(66, Math.max(50, stdout?.columns ?? 66));
  const compact = width < 60;

  const [usage, setUsage] = useState<UsageSnapshot | null>(null);
  const [usageFetchedAt, setUsageFetchedAt] = useState<Date | null>(null);
  const [fallback, setFallback] = useState<{
    fetchedAt: Date;
    fiveHour: UsageSnapshot['fiveHour'];
    sevenDay: UsageSnapshot['sevenDay'];
  } | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [, forceTick] = useState(0);

  useInput((input, key) => {
    if (input === 'q' || (key.ctrl && input === 'c')) exit();
    if (input === 'r') void poll();
  });

  async function poll() {
    const [creds, snap, liveSessions] = await Promise.all([
      readCredentials(),
      readSnapshot(),
      readSessions(),
    ]);
    setSessions(liveSessions);
    if (snap) setFallback(snap);

    if (creds) {
      const result = await fetchUsage(creds);
      if (result.ok) {
        setUsage(result.snapshot);
        setUsageFetchedAt(result.snapshot.fetchedAt);
        const point: HistoryPoint = {
          ts: result.snapshot.fetchedAt.getTime(),
          fiveHour: result.snapshot.fiveHour?.utilization ?? null,
          sevenDay: result.snapshot.sevenDay?.utilization ?? null,
        };
        await appendIfChanged(point);
        setHistory((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.fiveHour === point.fiveHour && last.sevenDay === point.sevenDay) {
            return prev;
          }
          return [...prev, point];
        });
      }
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: poll() reads only module-level data sources; re-subscribing per render would stack intervals.
  useEffect(() => {
    void (async () => {
      const pruned = await pruneOnStartup();
      setHistory(pruned);
      void poll();
    })();

    const pollTimer = setInterval(() => void poll(), POLL_MS);
    const tickTimer = setInterval(() => forceTick((n) => n + 1), TICK_MS);
    return () => {
      clearInterval(pollTimer);
      clearInterval(tickTimer);
    };
  }, []);

  const fiveHour = usage?.fiveHour ?? fallback?.fiveHour ?? null;
  const sevenDay = usage?.sevenDay ?? fallback?.sevenDay ?? null;
  const lastFetchedAt = usageFetchedAt ?? fallback?.fetchedAt ?? null;
  const freshness = freshnessFor(lastFetchedAt);

  const fiveHourStart = fiveHour?.resetsAt
    ? new Date(fiveHour.resetsAt.getTime() - FIVE_HOUR_MS)
    : null;
  const sevenDayStart = sevenDay?.resetsAt
    ? new Date(sevenDay.resetsAt.getTime() - SEVEN_DAY_MS)
    : null;

  const fiveHourProjection = fiveHourStart
    ? project(history, (p) => p.fiveHour, fiveHourStart, fiveHour?.resetsAt ?? null)
    : null;
  const sevenDayProjection = sevenDayStart
    ? project(history, (p) => p.sevenDay, sevenDayStart, sevenDay?.resetsAt ?? null)
    : null;

  const fiveHourSpark = fiveHourStart
    ? seriesFor(
        history.filter((p) => p.ts >= (fiveHourStart?.getTime() ?? 0)),
        (p) => p.fiveHour,
      )
    : [];
  const sevenDaySpark = sevenDayStart
    ? seriesFor(
        history.filter((p) => p.ts >= (sevenDayStart?.getTime() ?? 0)),
        (p) => p.sevenDay,
      )
    : [];

  return (
    <GradientBox width={width}>
      <Box justifyContent="space-between">
        <GradientText>CC·USAGE</GradientText>
        <Text color={MUTED}>
          {STATUS_ICON[freshness]} {freshness === 'live' ? 'live' : freshness} ·{' '}
          {age(lastFetchedAt) ?? '—'}
        </Text>
      </Box>
      <Box height={1} />

      <WindowPanel
        icon={ICON.fiveHour}
        label="5 HORAS"
        window={fiveHour}
        sparklineValues={fiveHourSpark}
        projection={fiveHourProjection}
        compact={compact}
      />
      <Box height={1} />

      <WindowPanel
        icon={ICON.weekly}
        label="SEMANAL"
        window={sevenDay}
        sparklineValues={sevenDaySpark}
        projection={sevenDayProjection}
        compact={compact}
      />

      {usage?.sevenDayOpus && (
        <WindowPanel icon={ICON.opus} label="OPUS 7d" window={usage.sevenDayOpus} compact />
      )}
      {usage?.sevenDaySonnet && (
        <WindowPanel icon={ICON.sonnet} label="SONNET 7d" window={usage.sevenDaySonnet} compact />
      )}
      {usage?.credits && (
        <WindowPanel icon={ICON.credits} label="CRÉDITOS" window={usage.credits} compact />
      )}

      <Box height={1} />
      <SessionsPanel sessions={sessions} />

      <Box height={1} />
      <Text color={MUTED}>q salir · r refrescar ya</Text>
    </GradientBox>
  );
}
