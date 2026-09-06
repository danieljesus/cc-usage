export const MUTED = 'gray';
export const SUCCESS = 'green';
export const WARNING = 'yellow';
export const ERROR = 'red';

// Slightly darker than the plain named "gray" — inactive labels read as too
// light against the background at full gray. Copied from arch-terminal.
export const INACTIVE = '#4b5563';

/** Section icons — kept as one named table so they're not scattered loose through JSX. */
// Emoji restored after TWO independent real measurements, not a guess —
// each one catches a different bug class, and a glyph has to pass both:
//
// 1. Real-terminal width (`scripts/measure-glyph-widths.mjs`): writes each
//    candidate to a live terminal and reads its actual cursor advance back
//    via DSR (`\x1b[6n`), compared against what `string-width` (what Ink's
//    layout measures with) computes. Run in a real Windows Terminal window
//    (`capture-out/glyph-widths.txt`, WT profile
//    `{3ad42e7b-e073-5f3e-ac57-1c259ffa86a8}`, 2026-09-06) — a spawned
//    window, not proven identical to every profile this app runs in, so a
//    fragment reappearing on a specific machine means re-running this
//    script there and dropping that one icon back to ASCII.
// 2. Ink's own internal grid writer (no terminal involved at all — pure
//    `ink-testing-library`): render `<Text>{icon} </Text><Text>NAME</Text>`
//    in a bare Box and check the output is exactly `"{icon} NAME"`, one
//    space. This is the one that actually caught something: `🖥️` (desktop
//    computer + VS16) silently ate the space (`"🖥️NAME"`), and `⚡`
//    (lightning, no VS16) doubled it (`"⚡  NAME"`) — both **before
//    anything reaches a terminal**, entirely inside Ink's own Yoga/Output
//    layer. Both passed check #1 (real width 2, matching what Ink budgets)
//    yet were still broken — proof the original "terminal disagrees with
//    Ink" theory, while real for `·`/`—`, was never the full story for
//    every glyph. `💻` and `🏃` below are their replacements: same
//    real-world width (2, confirmed both ways), no grid-writer bug.
//
// Every other icon here passed both checks in its ORIGINAL form (including
// trailing U+FE0F where present) and needed no substitution.
export const ICON = {
  fiveHour: '⏳️',
  weekly: '📅',
  opus: '🧠',
  sonnet: '🎯',
  credits: '💳',
  burnRate: '🔥',
  sparkline: '📊',
  sessions: '💻', // was 🖥️ — ate its trailing space in Ink's own output buffer, see above
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
  working: '🏃', // was ⚡ — doubled its trailing space in Ink's own output buffer, see ICON above
  idle: '💤',
} as const;
