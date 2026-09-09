import { render } from 'ink';
import { App } from './app.js';
import { setInkInstance } from './ink-handle.js';
import { ENTER_ALT_SCREEN, EXIT_ALT_SCREEN } from './terminal-escapes.js';

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
 * The resize-clear itself lives in app.tsx, not here — confirmed via a real
 * conpty byte capture (feeding cc-usage's actual output stream into a pty
 * and resizing it, then reading the raw bytes) that a `process.stdout.on
 * ('resize', ...)` listener registered here, before render(), still isn't
 * early enough to win: Ink has its own internal resize handling that
 * re-serializes the *already-rendered* Yoga/React tree straight to the
 * terminal at the new dimensions, without re-invoking this component. That
 * repaint uses layout computed for the OLD width, so it overflows the new
 * (narrower) terminal and wraps — and it happens regardless of a listener
 * registered before render(), which only wins the ordering race against
 * Ink's *own* 'resize' listener, not against this internal repaint path.
 *
 * The captured byte stream showed the sequence precisely: our old clear+home
 * here, immediately followed by that malformed stale-width frame — undoing
 * the clear before anything correct ever reached the terminal. Concretely,
 * that malformed frame is missing its right border and status text
 * (pushed past column 80 by layout still sized for column 120), and writing
 * enough lines to force the terminal to scroll. A subsequent *correct*
 * frame, even a perfectly clean one, then lands on an already-scrolled
 * viewport — which is exactly the "old content peeking in above the new
 * frame" the real-Windows-Terminal screenshots kept showing on narrower
 * resizes specifically (not shorter/wider/back-to-original, which don't
 * force that overflow).
 *
 * app.tsx's own resize handler is registered inside a `useEffect`, which
 * commits strictly after Ink's initial render/mount — so by construction it
 * always runs *after* Ink's internal stale-layout repaint, never before. Its
 * job is to clear right after that repaint (undoing its damage, scrollback
 * included) and only then force a real React re-render with the current
 * width, so the correct frame is the only thing written after the clear.
 */
const instance = render(<App />);
setInkInstance(instance);

instance.waitUntilExit().then(
  () => restoreScreen(),
  (error: unknown) => {
    restoreScreen();
    console.error(error);
    process.exitCode = 1;
  },
);
