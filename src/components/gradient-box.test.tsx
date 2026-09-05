import { Text } from 'ink';
import { render } from 'ink-testing-library';
import stringWidth from 'string-width';
import { describe, expect, it } from 'vitest';
import { GradientBox } from './gradient-box.js';

describe('GradientBox', () => {
  it('renders every row at exactly the declared width', () => {
    // Regression test: the hand-drawn top/bottom border rows and Ink's
    // native left/right border on the content rows must agree on total
    // width, or the box doesn't close as a rectangle (see git history for
    // the redraw bugs this class of mismatch caused).
    for (const width of [20, 40, 66, 100]) {
      const { lastFrame } = render(
        <GradientBox width={width}>
          <Text>hello</Text>
        </GradientBox>,
      );
      const lines = (lastFrame() ?? '').split('\n');
      for (const line of lines) {
        expect(stringWidth(line)).toBe(width);
      }
    }
  });

  it('starts the top row with ╭ and ends it with ╮', () => {
    const { lastFrame } = render(
      <GradientBox width={20}>
        <Text>x</Text>
      </GradientBox>,
    );
    const top = (lastFrame() ?? '').split('\n')[0];
    expect(top.startsWith('╭')).toBe(true);
    expect(top.endsWith('╮')).toBe(true);
  });

  it('closes the bottom row with ╰ and ╯', () => {
    const { lastFrame } = render(
      <GradientBox width={20}>
        <Text>x</Text>
      </GradientBox>,
    );
    const lines = (lastFrame() ?? '').split('\n');
    const bottom = lines[lines.length - 1];
    expect(bottom.startsWith('╰')).toBe(true);
    expect(bottom.endsWith('╯')).toBe(true);
  });

  it('renders content rows with a │ on both edges', () => {
    const { lastFrame } = render(
      <GradientBox width={20}>
        <Text>x</Text>
      </GradientBox>,
    );
    const lines = (lastFrame() ?? '').split('\n');
    const contentRow = lines[1];
    expect(contentRow.startsWith('│')).toBe(true);
    expect(contentRow.endsWith('│')).toBe(true);
  });

  it('handles multi-row content without breaking row width', () => {
    const { lastFrame } = render(
      <GradientBox width={30}>
        <Text>line one</Text>
        <Text>a much longer second line of text</Text>
      </GradientBox>,
    );
    const lines = (lastFrame() ?? '').split('\n');
    for (const line of lines) {
      expect(stringWidth(line)).toBe(30);
    }
  });
});
