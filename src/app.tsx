import { Box, Text, useApp, useInput, useStdin, useStdout } from 'ink';
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

const DEFAULT_COLUMNS = 80;

const POLL_MS = 30_000;
const TICK_MS = 1_000;
const FIVE_HOUR_MS = 5 * 60 * 60 * 1000;
const SEVEN_DAY_MS = 7 * 24 * 60 * 60 * 1000;

// No upper cap: the box tracks the terminal's actual width. RIGHT_MARGIN
// keeps every row strictly short of the terminal's last column — landing
// exactly on it triggers the terminal's own auto-wrap, which Ink's cursor
// math doesn't expect. That desync leaves one stale line behind on every
// redraw after that, which compounds into a growing staircase of leftover
// border fragments the longer the app runs. 1 column of margin isn't
// enough insurance against a still-mismeasured glyph tipping a row over
// by one column, hence 2.
const MIN_WIDTH = 50;
const RIGHT_MARGIN = 2;
// Meter/sparkline size at the box width we designed the layout at (66 cols,
// i.e. 62 of content) — extra terminal width beyond that grows them instead
// of just leaving dead space on the right.
const BASELINE_CONTENT_WIDTH = 62;
const BASELINE_METER_WIDTH = 20;
const BASELINE_SPARK_WIDTH = 10;
const MAX_METER_WIDTH = 80;
const MAX_SPARK_WIDTH = 40;

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
  const { isRawModeSupported } = useStdin();
  // Read stdout.columns directly on every render rather than mirroring it
  // into React state. Ink itself listens for the terminal's 'resize' event
  // and immediately forces a fresh render pass — before any state-update
  // listener of ours would get a chance to run — so a cached column count
  // is guaranteed to be one resize stale exactly when it matters most:
  // Ink's own layout has already snapped to the new width, and a box still
  // requesting the old one is what desyncs the redraw math and leaves the
  // stale-line "staircase" behind. Reading live avoids that class of bug
  // entirely — there's no cached value to be behind.
  const { stdout } = useStdout();
  const columns = stdout.columns || DEFAULT_COLUMNS;
  const width = Math.max(MIN_WIDTH, columns - RIGHT_MARGIN);
  const compact = width < 60;
  const contentWidth = width - 4;
  const extra = Math.max(0, contentWidth - BASELINE_CONTENT_WIDTH);
  const meterWidth = Math.min(MAX_METER_WIDTH, BASELINE_METER_WIDTH + Math.floor(extra * 0.7));
  const sparkWidth = Math.min(MAX_SPARK_WIDTH, BASELINE_SPARK_WIDTH + Math.floor(extra * 0.3));

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

  // isActive must be the strict boolean `false` to skip Ink's raw-mode listener —
  // it checks `=== false`, and `isRawModeSupported` comes through as `undefined`
  // (not `false`) when stdin isn't a TTY, so the loose value alone doesn't stop it.
  useInput(
    (input, key) => {
      if (input === 'q' || (key.ctrl && input === 'c')) exit();
      if (input === 'r') void poll();
    },
    { isActive: isRawModeSupported === true },
  );

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
        meterWidth={meterWidth}
        sparkWidth={sparkWidth}
        compact={compact}
      />
      <Box height={1} />

      <WindowPanel
        icon={ICON.weekly}
        label="SEMANAL"
        window={sevenDay}
        sparklineValues={sevenDaySpark}
        projection={sevenDayProjection}
        meterWidth={meterWidth}
        sparkWidth={sparkWidth}
        compact={compact}
      />

      {usage?.sevenDayOpus && (
        <WindowPanel
          icon={ICON.opus}
          label="OPUS 7d"
          window={usage.sevenDayOpus}
          meterWidth={meterWidth}
          compact
        />
      )}
      {usage?.sevenDaySonnet && (
        <WindowPanel
          icon={ICON.sonnet}
          label="SONNET 7d"
          window={usage.sevenDaySonnet}
          meterWidth={meterWidth}
          compact
        />
      )}
      {usage?.credits && (
        <WindowPanel
          icon={ICON.credits}
          label="CRÉDITOS"
          window={usage.credits}
          meterWidth={meterWidth}
          compact
        />
      )}

      <Box height={1} />
      <SessionsPanel sessions={sessions} width={contentWidth} />

      <Box height={1} />
      <Text color={MUTED}>
        {isRawModeSupported ? 'q salir · r refrescar ya' : 'ctrl+c para salir'}
      </Text>
    </GradientBox>
  );
}
