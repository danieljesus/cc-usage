#!/usr/bin/env node
import { render } from 'ink';
import { App } from './app.js';

const ENTER_ALT_SCREEN = '\x1b[?1049h';
const EXIT_ALT_SCREEN = '\x1b[?1049l';

/**
 * Alternate screen buffer: cc-usage takes over the terminal viewport like
 * vim/htop instead of scrolling through the shell's own history, and the
 * typed `cc-usage` command line disappears along with it. This also
 * sidesteps a whole class of redraw bug — Ink's incremental redraw tracks
 * how many lines to erase before repainting the next frame, and a single
 * frame that's one line taller than expected (an unexpected terminal
 * auto-wrap, say) desyncs that count for every frame after it, leaving
 * stale fragments behind. A full-screen app has no shell scrollback to
 * stay in sync with, so that failure mode doesn't apply here.
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

const instance = render(<App />);

instance.waitUntilExit().then(
  () => restoreScreen(),
  (error: unknown) => {
    restoreScreen();
    console.error(error);
    process.exitCode = 1;
  },
);
