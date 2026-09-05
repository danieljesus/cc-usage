// ASCII printable, or any Latin-script character (covers Spanish/European
// accented letters — á, ñ, ü — all of them narrow/unambiguous in practice).
// Everything else (emoji, dingbats, symbols, other scripts) is replaced.
const SAFE_CHAR = /[ -~]|\p{Script=Latin}/u;

/**
 * Every icon this app draws is a curated, individually-verified glyph. But
 * `session.name`/`session.cwd` (data/sessions.ts) come from OTHER
 * processes — the same Claude Code fleet that names forks and subagents —
 * and aren't curated at all. One real session name on this machine
 * contained U+2442 (⑂): evidence that arbitrary non-ASCII characters do
 * show up here in practice, even if that specific one turned out to be
 * harmless.
 *
 * The first version of this function filtered on Unicode's East Asian
 * Width "Ambiguous" category — the wrong axis. That property governs
 * legacy CJK-context rendering (★, §, ±...) and is unrelated to the actual
 * bug class this project kept hitting: emoji/symbol Emoji_Presentation
 * ambiguity (⚡, ⏳, ✅, ⏰, all fixed by hand elsewhere). Worse, several
 * ordinary accented Latin letters are themselves EAW-Ambiguous — 'ó', 'ñ'
 * included — so that version mangled perfectly normal Spanish text into
 * question marks. Caught immediately by this file's own tests.
 *
 * This version allows anything a Spanish/European session name would
 * plausibly contain (ASCII, Latin-script letters) and replaces everything
 * else with '?' (always narrow, always 1 column, in every terminal) —
 * emoji, dingbats, symbols, other scripts — before any width budgeting or
 * truncation happens.
 */
export function sanitizeWidth(text: string): string {
  let out = '';
  for (const char of text) {
    out += SAFE_CHAR.test(char) ? char : '?';
  }
  return out;
}
