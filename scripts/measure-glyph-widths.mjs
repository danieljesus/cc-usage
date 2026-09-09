#!/usr/bin/env node
// One-shot diagnostic: measures how many columns Windows Terminal's real
// buffer (conhost/ConPTY — the layer that also decides auto-wrap, and the
// one Ink's own `string-width`-based layout needs to agree with) actually
// advances the cursor for each candidate icon glyph, and compares it
// against what `string-width` (Ink's own width dependency) computes.
//
// Must be run directly in a real interactive terminal:
//   node scripts/measure-glyph-widths.mjs
// Never piped/redirected — DSR (cursor position report) needs a live TTY on
// both ends. Writes its own report to capture-out/glyph-widths.txt (already
// gitignored) in addition to printing it, so redirecting stdout is never
// necessary to capture the result.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import stringWidth from 'string-width';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, '..', 'capture-out', 'glyph-widths.txt');

const PROBE_TIMEOUT_MS = 500;
const GLOBAL_BUDGET_MS = 20_000;
const startedAt = Date.now();

// ---------------------------------------------------------------------------
// Raw-mode DSR (Device Status Report) plumbing. Mirrors the restore-on-exit
// pattern already used in src/main.tsx (guard + finally + exit/SIGINT/SIGTERM)
// so this never leaves the user's shell in raw mode if something throws.
// ---------------------------------------------------------------------------

let dsrBuffer = '';
/** @type {((col: number) => void) | null} */
let pendingResolve = null;
/** @type {(() => void) | null} */
let pendingReject = null;

function onStdinData(chunk) {
  if (chunk === '') {
    cleanup();
    process.exit(130);
  }
  dsrBuffer += chunk;
  // biome-ignore lint/suspicious/noControlCharactersInRegex: matching a real DSR response, which starts with ESC by definition (\x1b[<row>;<col>R).
  const match = dsrBuffer.match(/\x1b\[(\d+);(\d+)R/);
  if (match) {
    // Always consume a matched response, even a stale one arriving after its
    // own probe already timed out — otherwise it lingers in the buffer and
    // gets mistaken for the NEXT probe's response.
    dsrBuffer = dsrBuffer.slice((match.index ?? 0) + match[0].length);
    if (pendingResolve) {
      const resolve = pendingResolve;
      pendingResolve = null;
      pendingReject = null;
      resolve(Number(match[2]));
    }
  }
}

function requestCursorColumn() {
  return new Promise((resolve, reject) => {
    pendingResolve = resolve;
    pendingReject = reject;
    const timer = setTimeout(() => {
      if (pendingReject === reject) {
        pendingResolve = null;
        pendingReject = null;
        reject(new Error('DSR timeout'));
      }
    }, PROBE_TIMEOUT_MS);
    // Wrap resolve so the timer always clears, success or failure.
    const originalResolve = resolve;
    pendingResolve = (col) => {
      clearTimeout(timer);
      originalResolve(col);
    };
    process.stdout.write('\x1b[6n');
  });
}

/** Erase the current line, measure cursor column, write `sample`, measure again. */
async function measureRealWidth(sample) {
  process.stdout.write('\r\x1b[2K');
  const before = await requestCursorColumn();
  if (before !== 1) {
    throw new Error(`expected column 1 before probe, got ${before}`);
  }
  process.stdout.write(sample);
  const after = await requestCursorColumn();
  process.stdout.write('\r\x1b[2K');
  return after - before;
}

let restored = false;
function cleanup() {
  if (restored) return;
  restored = true;
  process.stdin.removeListener('data', onStdinData);
  if (process.stdin.isTTY) process.stdin.setRawMode(false);
  process.stdin.pause();
  process.stdout.write('\r\x1b[2K\n');
}

// ---------------------------------------------------------------------------
// Candidate glyphs
// ---------------------------------------------------------------------------

/** First codepoint only — strips any trailing variation selector etc. */
function baseOf(str) {
  return String.fromCodePoint(str.codePointAt(0));
}

function codepointsOf(str) {
  return [...str].map((c) => `U+${c.codePointAt(0).toString(16).toUpperCase()}`).join(' ');
}

// The 17 original icons this app shipped with before the ASCII swap, exactly
// as they appeared in src/theme.ts's git history.
const ORIGINAL_ICONS = [
  ['ICON.fiveHour', '⏳️'],
  ['ICON.weekly', '📅'],
  ['ICON.opus', '🧠'],
  ['ICON.sonnet', '🎯'],
  ['ICON.credits', '💳'],
  ['ICON.burnRate', '🔥'],
  ['ICON.sparkline', '📊'],
  ['ICON.sessions', '🖥️'],
  ['ICON.resetClock', '⏰️'],
  ['STATUS_ICON.live', '🟢'],
  ['STATUS_ICON.stale', '🟡'],
  ['STATUS_ICON.offline', '🔴'],
  ['VERDICT_ICON.comfortable', '✅️'],
  ['VERDICT_ICON.tight', '⚠️'],
  ['VERDICT_ICON.exhaustsBeforeReset', '🚨'],
  ['SESSION_ICON.working', '⚡'],
  ['SESSION_ICON.idle', '💤'],
];

const SUBSTITUTE_CANDIDATES = [
  ['substitute.laptop', '💻'],
  ['substitute.people', '👥'],
  ['substitute.hourglassBmp', '⌛'],
  ['substitute.exclamation', '❗'],
  ['substitute.crossMark', '❌'],
  ['substitute.bell', '🔔'],
  ['substitute.chartUp', '📈'],
  ['substitute.clock', '🕐'],
  ['substitute.bulb', '💡'],
  ['substitute.orangeCircle', '🟠'],
];

const CONTROLS = [
  ['control.sessionDot', '●'],
  ['control.midDot', '·'],
  ['control.emDash', '—'],
  ['control.boxCorner', '╭'],
  ['control.boxHorizontal', '─'],
  ['control.boxVertical', '│'],
  ['control.asciiGt', '>'],
  ['control.asciiHash', '#'],
  ['control.asciiCaret', '^'],
  ['control.asciiStar', '*'],
  ['control.asciiDollar', '$'],
  ['control.asciiBang', '!'],
  ['control.asciiTilde', '~'],
  ['control.asciiEquals', '='],
  ['control.asciiAt', '@'],
];

const ASSEMBLED_ROWS = [
  ['assembled.sessionsHeader', '🖥️ SESIONES ACTIVAS (3)'],
  ['assembled.liveStatus', '🟢 live - 2m'],
  ['assembled.fiveHourLabel', '⏳ 5 HORAS'],
  ['assembled.burnAndVerdict', '🔥 +1.2%/h   ⚠️ ajustado, poco margen'],
];

// ---------------------------------------------------------------------------
// Report assembly
// ---------------------------------------------------------------------------

function padCol(value, width) {
  const str = String(value);
  return str.length >= width ? `${str} ` : str + ' '.repeat(width - str.length);
}

function formatRow(slot, form, codepoints, ink, real) {
  const verdict = real === 'TIMEOUT' ? 'TIMEOUT' : ink === real ? 'MATCH' : 'MISMATCH';
  return (
    padCol(slot, 32) +
    padCol(form, 12) +
    padCol(codepoints, 22) +
    padCol(ink, 5) +
    padCol(real, 5) +
    verdict
  );
}

async function main() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error(
      'Run this directly in Windows Terminal; do not pipe or redirect it (needs a live TTY on both ends).',
    );
    process.exit(1);
  }

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', onStdinData);
  process.on('exit', cleanup);
  process.on('SIGINT', () => {
    cleanup();
    process.exit(130);
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(143);
  });

  const lines = [];
  lines.push(
    `${
      padCol('slot', 32) +
      padCol('form', 12) +
      padCol('codepoints', 22) +
      padCol('ink', 5) +
      padCol('real', 5)
    }verdict`,
  );

  // Calibration gate: prove the DSR technique is actually live in THIS
  // terminal before trusting a single candidate measurement. 'A' must be 1
  // column everywhere; '漢' (U+6F22, a CJK ideograph) must be 2 columns in
  // every terminal that implements East Asian Width at all.
  let calibrationOk = true;
  try {
    const aWidth = await measureRealWidth('A');
    const hanWidth = await measureRealWidth('漢');
    if (aWidth !== 1 || hanWidth !== 2) calibrationOk = false;
    lines.push(formatRow('CALIBRATION', 'ascii', codepointsOf('A'), 1, aWidth));
    lines.push(formatRow('CALIBRATION', 'cjk-wide', codepointsOf('漢'), 2, hanWidth));
  } catch (err) {
    console.error(`Calibration failed: ${err instanceof Error ? err.message : err}`);
    cleanup();
    process.exit(1);
  }

  if (!calibrationOk) {
    console.error(
      'Calibration mismatch — this terminal is not reporting DSR cursor positions as expected. Aborting rather than printing an untrustworthy table.',
    );
    cleanup();
    process.exit(1);
  }

  /** @param {[string, string][]} entries */
  async function measureBatch(entries, formName, transform = (s) => s) {
    for (const [slot, original] of entries) {
      if (Date.now() - startedAt > GLOBAL_BUDGET_MS) {
        lines.push(
          formatRow(slot, formName, codepointsOf(original), stringWidth(original), 'TIMEOUT'),
        );
        continue;
      }
      const sample = transform(original);
      const ink = stringWidth(sample);
      let real;
      try {
        real = await measureRealWidth(sample);
      } catch {
        real = 'TIMEOUT';
      }
      lines.push(formatRow(slot, formName, codepointsOf(sample), ink, real));
    }
  }

  await measureBatch(ORIGINAL_ICONS, 'base', baseOf);
  await measureBatch(ORIGINAL_ICONS, '+VS16', (s) => `${baseOf(s)}️`);
  await measureBatch(ORIGINAL_ICONS, 'as-written');
  await measureBatch(SUBSTITUTE_CANDIDATES, 'base', baseOf);
  await measureBatch(SUBSTITUTE_CANDIDATES, '+VS16', (s) => `${baseOf(s)}️`);
  await measureBatch(CONTROLS, 'as-written');
  await measureBatch(ASSEMBLED_ROWS, 'assembled');

  const matchCount = lines.filter((l) => l.endsWith('MATCH')).length;
  const mismatchCount = lines.filter((l) => l.endsWith('MISMATCH')).length;
  const timeoutCount = lines.filter((l) => l.endsWith('TIMEOUT')).length;

  const envBlock = [
    '',
    '--- environment ---',
    `platform: ${process.platform}`,
    `node: ${process.version}`,
    `stdout.columns: ${process.stdout.columns}`,
    `WT_SESSION: ${process.env.WT_SESSION ?? '(unset)'}`,
    `WT_PROFILE_ID: ${process.env.WT_PROFILE_ID ?? '(unset)'}`,
    `TERM_PROGRAM: ${process.env.TERM_PROGRAM ?? '(unset)'}`,
    `MATCH: ${matchCount}  MISMATCH: ${mismatchCount}  TIMEOUT: ${timeoutCount}`,
  ];

  const report = [...lines, ...envBlock].join('\n');

  cleanup();

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, report, 'utf8');

  console.log(report);
  console.log(`\nWritten to ${OUT_PATH} — paste the table back, or just say "listo".`);
}

main().catch((err) => {
  cleanup();
  console.error(err);
  process.exit(1);
});
