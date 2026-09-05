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
 * the terminal actually shows — a stray auto-wrap, a resize landing between
 * Ink recalculating its layout and this process's own width read — and once
 * it does, a fragment of an old, differently-sized frame (usually a stale
 * border segment) is left behind for good; nothing later ever repaints that
 * cell because nothing knows it's dirty. Several narrower fixes narrowed the
 * gap without closing it, so this is the backstop: on every resize, before
 * Ink gets a chance to do its own incremental erase, wipe the whole alt
 * screen and put the cursor at the top. Whatever Ink draws next lands on a
 * verified-blank buffer, independent of whatever its internal line count
 * believes. Registered before `render()` so it runs before Ink's own
 * 'resize' listener (Node calls listeners in registration order).
 */
if (process.stdout.isTTY) {
  process.stdout.on('resize', () => {
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
