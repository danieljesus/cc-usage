import { render } from 'ink-testing-library';
import stringWidth from 'string-width';
import { describe, expect, it } from 'vitest';
import type { SessionInfo } from '../data/sessions.js';
import { SessionsPanel } from './sessions-panel.js';

function session(overrides: Partial<SessionInfo> = {}): SessionInfo {
  return {
    pid: 1,
    name: 'my-session',
    cwd: '~/projects/foo',
    activity: 'working',
    updatedAt: new Date(),
    background: false,
    ...overrides,
  };
}

describe('SessionsPanel', () => {
  it('shows a placeholder when there are no sessions', () => {
    const { lastFrame } = render(<SessionsPanel sessions={[]} width={60} />);
    expect(lastFrame()).toContain('ninguna sesión detectada');
  });

  it('shows the session count in the header', () => {
    const { lastFrame } = render(
      <SessionsPanel sessions={[session(), session({ pid: 2 })]} width={60} />,
    );
    expect(lastFrame()).toContain('SESIONES ACTIVAS (2)');
  });

  it('never renders a row wider than the given width, across a wide range of widths', () => {
    // Regression test: this row used to be sized to sum to *exactly* width
    // with zero margin, which is what caused it to occasionally tip over
    // the terminal's edge and desync Ink's redraw bookkeeping.
    for (const width of [30, 46, 62, 78, 96]) {
      const { lastFrame } = render(
        <SessionsPanel
          sessions={[session({ name: 'a-fairly-long-session-name-here' })]}
          width={width}
        />,
      );
      const lines = (lastFrame() ?? '').split('\n');
      for (const line of lines) {
        expect(stringWidth(line)).toBeLessThanOrEqual(width);
      }
    }
  });

  it('indents session rows 2 columns further than the header, nesting them under it', () => {
    // Regression test: session rows used to start flush with the
    // "SESIONES ACTIVAS" header instead of reading as its children.
    const { lastFrame } = render(<SessionsPanel sessions={[session()]} width={60} />);
    const lines = (lastFrame() ?? '').split('\n');
    const headerIndent = lines[0].search(/\S/);
    const rowIndent = lines[1].search(/\S/);
    expect(rowIndent).toBe(headerIndent + 2);
  });

  it('truncates a session name that does not fit its column', () => {
    const { lastFrame } = render(
      <SessionsPanel
        sessions={[session({ name: 'a-very-long-session-name-that-will-not-fit' })]}
        width={40}
      />,
    );
    expect(lastFrame()).toContain('…');
  });

  it('drops the cwd column once the terminal is too narrow for it', () => {
    const wide = render(<SessionsPanel sessions={[session({ cwd: '~/some/path' })]} width={80} />);
    const narrow = render(
      <SessionsPanel sessions={[session({ cwd: '~/some/path' })]} width={30} />,
    );
    expect(wide.lastFrame()).toContain('~/some/path');
    expect(narrow.lastFrame()).not.toContain('~/some/path');
  });

  it('renders the activity marker for both working and idle sessions', () => {
    // Working/idle is communicated by the marker's color (checked in the
    // app visually — ink-testing-library's lastFrame() strips ANSI color,
    // so it can't be asserted here), not by glyph shape: both activities
    // render the same unambiguous single-column bullet.
    for (const activity of ['working', 'idle'] as const) {
      const { lastFrame } = render(<SessionsPanel sessions={[session({ activity })]} width={60} />);
      expect(lastFrame() ?? '').toContain('●');
    }
  });

  it('always puts a literal space between the icon and the name', () => {
    // Regression test: the icon used to sit in a fixed-width Box that let
    // Ink compute the gap as padding. Ink's own width estimate for the icon
    // and the terminal's actual rendered width don't always agree, and when
    // they're off by as little as one column, the computed padding rounds
    // down to zero — the name ends up touching the icon with no visible
    // gap. A literal space byte in the string can't be rounded away.
    for (const activity of ['working', 'idle'] as const) {
      const { lastFrame } = render(
        <SessionsPanel sessions={[session({ activity, name: 'my-session' })]} width={60} />,
      );
      const row = (lastFrame() ?? '').split('\n')[1];
      expect(row).toMatch(/● my-session/);
    }
  });

  it('shows "<1m" for a session updated less than a minute ago', () => {
    const { lastFrame } = render(
      <SessionsPanel sessions={[session({ updatedAt: new Date() })]} width={60} />,
    );
    expect(lastFrame()).toContain('<1m');
  });

  it('caps visible session rows and summarizes the rest', () => {
    // The session count is the one thing in this layout that changes the
    // app's total rendered height on its own — Ink only guards against a
    // desynced incremental redraw once total height reaches the terminal's
    // row count, so an unbounded list risked crossing that threshold on
    // every session added or removed. Capping keeps this panel's height
    // constant past that point regardless of how many sessions are live.
    const many = Array.from({ length: 10 }, (_, i) => session({ pid: i }));
    const { lastFrame } = render(<SessionsPanel sessions={many} width={60} />);
    const frame = lastFrame() ?? '';
    expect(frame).toContain('SESIONES ACTIVAS (10)');
    expect(frame).toContain('+4 más');
    expect(frame.split('\n')).toHaveLength(1 + 6 + 1); // header + 6 rows + summary
  });

  it('shows no summary line when every session fits', () => {
    const { lastFrame } = render(<SessionsPanel sessions={[session()]} width={60} />);
    expect(lastFrame() ?? '').not.toContain('más');
  });
});
