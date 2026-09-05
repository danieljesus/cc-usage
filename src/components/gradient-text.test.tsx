import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';
import { GradientText } from './gradient-text.js';

describe('GradientText', () => {
  it('renders the given text unchanged', () => {
    expect(render(<GradientText>CC·USAGE</GradientText>).lastFrame()).toBe('CC·USAGE');
  });

  it('does not divide by zero on a single character', () => {
    expect(render(<GradientText>x</GradientText>).lastFrame()).toBe('x');
  });

  it('renders empty input as empty output', () => {
    expect(render(<GradientText>{''}</GradientText>).lastFrame()).toBe('');
  });
});
