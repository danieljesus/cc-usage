export const MUTED = 'gray';
export const SUCCESS = 'green';
export const WARNING = 'yellow';
export const ERROR = 'red';

// Slightly darker than the plain named "gray" — inactive labels read as too
// light against the background at full gray. Copied from arch-terminal.
export const INACTIVE = '#4b5563';

/** Section icons — kept as one named table so they're not scattered loose through JSX. */
// Full emoji set, all in their original form — safe now for a real reason,
// not just "it looked fine this time":
//
// Two independent bug classes were chased across this glyph set. (1) A
// real-terminal width mismatch (Ink's `string-width`-based layout budget
// disagreeing with what Windows Terminal actually renders — verified with
// `scripts/measure-glyph-widths.mjs`, which writes each candidate to a live
// terminal and reads the real cursor advance back via DSR, `\x1b[6n`).
// (2) A genuine bug in Ink itself: its internal Output/grid writer used to
// miscompute certain glyphs' printed width independently of its own layout
// math, so a `<Text>{icon} </Text>` could render with the trailing space
// doubled or eaten entirely — reproducible with zero terminal involved,
// via plain `ink-testing-library` (`src/theme.test.tsx` encodes this check
// permanently, one case per icon here).
//
// `🖥️` and `⚡` hit exactly that Ink bug (confirmed: already reported and
// fixed upstream — vadimdemedes/ink#748, fixed in commit `557ed22`, shipped
// in Ink 6.3+). This project ran a substitute icon (💻/🏃) on Ink 5 while
// that fix was out of reach; upgrading to Ink 7 (`package.json`, needs
// React ≥19 — the reason Ink's own peer dependency jumped at 6.0) picks up
// the fix directly, so the originals are back with no workaround needed.
export const ICON = {
  fiveHour: '⏳️',
  weekly: '📅',
  opus: '🧠',
  sonnet: '🎯',
  fable: '🔮',
  // Any other per-model cap the API starts reporting under `limits[]`.
  model: '🧩',
  credits: '💳',
  burnRate: '🔥',
  sparkline: '📊',
  sessions: '🖥️',
  resetClock: '⏰️',
} as const;

/** Freshness / connection state shown as the header dot. */
export const STATUS_ICON = {
  live: '🟢',
  stale: '🟡',
  offline: '🔴',
} as const;

/** Projection verdicts for a usage window relative to its reset time. */
export const VERDICT_ICON = {
  comfortable: '✅️',
  tight: '⚠️',
  exhaustsBeforeReset: '🚨',
} as const;

export const SESSION_ICON = {
  working: '⚡',
  idle: '💤',
} as const;
