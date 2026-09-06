import { Box, Text } from 'ink';
import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';
import { ICON, SESSION_ICON, STATUS_ICON, VERDICT_ICON } from './theme.js';

// Regression guard for a bug class discovered directly (not by proxy): Ink's
// own internal Output/grid writer — no terminal involved at all — can eat or
// duplicate the literal space after specific glyphs (confirmed for 🖥️ and
// ⚡, see theme.ts's ICON comment). Every icon this app ever puts immediately
// before a literal space must render with exactly that one space, so a
// future icon swap that reintroduces the bug fails here instantly, without
// needing a real terminal or a user report.
function rendersWithExactlyOneSpace(icon: string): boolean {
  const { lastFrame } = render(
    <Box>
      <Text>{icon} </Text>
      <Text>NAME</Text>
    </Box>,
  );
  return lastFrame() === `${icon} NAME`;
}

describe('theme icons', () => {
  const allIcons = {
    ...ICON,
    ...STATUS_ICON,
    ...VERDICT_ICON,
    ...SESSION_ICON,
  };

  for (const [name, icon] of Object.entries(allIcons)) {
    it(`"${name}" (${JSON.stringify(icon)}) keeps its trailing space intact in Ink's own output`, () => {
      expect(rendersWithExactlyOneSpace(icon)).toBe(true);
    });
  }
});
