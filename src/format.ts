/** Compact time remaining until a Date: 5d2h / 2h14m / 47m. Null once it's passed. */
export function until(target: Date | null, now: Date = new Date()): string | null {
  if (!target) return null;
  const leftMs = target.getTime() - now.getTime();
  if (leftMs <= 0) return null;
  const mins = Math.floor(leftMs / 60000);
  if (mins >= 1440) return `${Math.floor(mins / 1440)}d${Math.floor((mins % 1440) / 60)}h`;
  if (mins >= 60) return `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, '0')}m`;
  return `${mins}m`;
}

const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/** Local wall-clock a Date falls at: "18:30" today, "mié 11/09 09:00" otherwise. */
export function resetAt(target: Date | null, now: Date = new Date()): string | null {
  if (!target) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  const time = `${pad(target.getHours())}:${pad(target.getMinutes())}`;
  const sameDay =
    target.getFullYear() === now.getFullYear() &&
    target.getMonth() === now.getMonth() &&
    target.getDate() === now.getDate();
  if (sameDay) return time;
  const weekday = WEEKDAYS[target.getDay()];
  const date = `${pad(target.getDate())}/${pad(target.getMonth() + 1)}`;
  return `${weekday} ${date} ${time}`;
}

/** Freshness label for the header dot: "12s", "4m", "1h03m". */
export function age(fetchedAt: Date | null, now: Date = new Date()): string | null {
  if (!fetchedAt) return null;
  const ms = now.getTime() - fetchedAt.getTime();
  if (ms < 0) return '0s';
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, '0')}m`;
}
