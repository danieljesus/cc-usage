export const ENTER_ALT_SCREEN = '\x1b[?1049h';
export const EXIT_ALT_SCREEN = '\x1b[?1049l';
// \x1b[3J also purges the scrollback, not just the visible screen — needed
// because a stale-width frame written between resize and our own redraw can
// overflow past the viewport and force a scroll; without 3J that pushed
// content stays reachable and a plain 2J+H can still land on an already
// -scrolled viewport, leaving old rows visible above row 1.
export const CLEAR_SCREEN = '\x1b[3J\x1b[2J\x1b[H';
