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
  // U+FE0F: same ambiguous-width risk as ⚡ below — ⏳ is a BMP Miscellaneous
  // Symbols character, the exact block where terminal font fallback most
  // often disagrees with Ink about text vs. emoji presentation. This one
  // sits on the box's leftmost column of every "5 HORAS" row, so a 1-column
  // mismatch here doesn't just misalign — it can push a whole row's content
  // to exactly the terminal's width and trigger an unwanted auto-wrap,
  // which desyncs Ink's redraw cursor math and leaves stale line fragments
  // behind on every subsequent frame (the "staircase" artifact).
  fiveHour: '⏳️',
  weekly: '📅',
  opus: '🧠',
  sonnet: '🎯',
  credits: '💳',
  burnRate: '🔥',
  sparkline: '📊',
  sessions: '🖥️',
  // ⏰ rather than a specific clock-face-at-N-o'clock glyph (🕕 etc.) —
  // those are uncommon enough that several terminal emoji fonts (Windows
  // Terminal included) fall back to a generic placeholder glyph for them.
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
  // Same BMP-ambiguity fix as ⏳/⚡ — ✅ is Dingbats block.
  comfortable: '✅️',
  tight: '⚠️',
  exhaustsBeforeReset: '🚨',
} as const;

// Plain geometric-shape glyphs, not emoji — same family arch-terminal uses
// for its own status glyphs (◆, ⊘, ◐...). Unlike every 2-column emoji
// above, these have no text/emoji presentation ambiguity at all: every
// terminal renders a single Unicode dingbat at exactly 1 column, always.
// Emoji here (⚡/💤 originally) kept losing their separating space to
// Ink's padding math whenever a terminal disagreed with Ink by even one
// column on how wide the glyph actually was — three rounds of that were
// enough; state is color now (green/dim), not glyph shape.
export const SESSION_ICON = {
  working: '●',
  idle: '●',
} as const;
