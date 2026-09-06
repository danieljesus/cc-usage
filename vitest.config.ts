import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Ink 7 colors via chalk's global singleton, which auto-detects from the
    // real process.stdout — not the fake, non-TTY stdout ink-testing-library
    // hands to render() per test. Without this, chalk sees vitest's actual
    // stdout (often TTY-like even under a test runner) and wraps every
    // colored <Text> in real ANSI codes, breaking every test that asserts
    // exact plain-text output. FORCE_COLOR=0 pins chalk to no-color
    // regardless of what it detects.
    env: {
      FORCE_COLOR: '0',
    },
  },
});
