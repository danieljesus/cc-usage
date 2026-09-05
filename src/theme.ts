export const MUTED = 'gray';
export const SUCCESS = 'green';
export const WARNING = 'yellow';
export const ERROR = 'red';

// Slightly darker than the plain named "gray" — inactive labels read as too
// light against the background at full gray. Copied from arch-terminal.
export const INACTIVE = '#4b5563';

export const SELECTION_CURSOR = '❯';

/** Section icons — kept as one named table so they're not scattered loose through JSX. */
export const ICON = {
  fiveHour: '⏳',
  weekly: '📅',
  opus: '🧠',
  sonnet: '🎯',
  credits: '💳',
  burnRate: '🔥',
  sparkline: '📊',
  sessions: '🖥️',
  resetClock: '🕕',
} as const;

/** Freshness / connection state shown as the header dot. */
export const STATUS_ICON = {
  live: '🟢',
  stale: '🟡',
  offline: '🔴',
} as const;

/** Projection verdicts for a usage window relative to its reset time. */
export const VERDICT_ICON = {
  comfortable: '✅',
  tight: '⚠️',
  exhaustsBeforeReset: '🚨',
} as const;

export const SESSION_ICON = {
  working: '⚡',
  idle: '💤',
} as const;
