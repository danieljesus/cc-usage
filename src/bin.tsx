#!/usr/bin/env node
import { render } from 'ink';
import { App } from './app.js';

const ENTER_ALT_SCREEN = '\x1b[?1049h';
const EXIT_ALT_SCREEN = '\x1b[?1049l';
const CLEAR_SCREEN = '\x1b[2J\x1b[H';

/**
 * Alternate screen buffer: cc-usage takes over the terminal viewport like
 * vim/htop instead of scrolling through the shell's own history, and the
 * typed `cc-usage` command line disappears along with it.
 *
 * Every exit path — 'q', Ctrl+C, a signal, an uncaught error — must still
 * restore the normal screen, or the terminal is left stuck showing the
 * alternate buffer.
 */
let restored = false;
function restoreScreen(): void {
  if (restored) return;
  restored = true;
  if (process.stdout.isTTY) process.stdout.write(EXIT_ALT_SCREEN);
}

if (process.stdout.isTTY) process.stdout.write(ENTER_ALT_SCREEN);
process.on('exit', restoreScreen);
process.on('SIGINT', () => {
  restoreScreen();
  process.exit(0);
});
process.on('SIGTERM', () => {
  restoreScreen();
  process.exit(0);
});

/**
 * Ink's own redraw is incremental: it erases exactly as many lines as its
 * last frame had and repaints on top. That bookkeeping can desync from what
 * the terminal actually shows — several concrete mechanisms for this were
 * found by reading ink's own source (see git history) — and once it does, a
 * fragment of an old frame (usually a stale border segment) is left behind
 * for good, since nothing downstream knows that cell is dirty. This is the
 * backstop for the *width*-changing case specifically: on every resize that
 * actually changes the column count, before Ink gets a chance to do its own
 * incremental erase, wipe the whole alt screen and put the cursor at the
 * top. Whatever Ink draws next lands on a verified-blank buffer, independent
 * of whatever its internal line count believes. Registered before
 * `render()` so it runs before Ink's own 'resize' listener (Node calls
 * listeners in registration order).
 *
 * Gated on columns actually changing, not on every 'resize' event: a
 * row-only resize (window height changed, width didn't) leaves this
 * process's rendered output byte-for-byte identical to the last frame, and
 * Ink's onRender skips repainting entirely when that's true (ink.js:
 * `output !== this.lastOutput`) — clearing unconditionally there blanks the
 * screen and nothing ever repaints it until the next unrelated tick.
 */
let lastColumns = process.stdout.columns;
if (process.stdout.isTTY) {
  process.stdout.on('resize', () => {
    const columns = process.stdout.columns;
    if (columns === lastColumns) return;
    lastColumns = columns;
    process.stdout.write(CLEAR_SCREEN);
  });
}

const instance = render(<App />);

instance.waitUntilExit().then(
  () => restoreScreen(),
  (error: unknown) => {
    restoreScreen();
    console.error(error);
    process.exitCode = 1;
  },
);
