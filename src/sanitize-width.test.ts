import { describe, expect, it } from 'vitest';
import { sanitizeWidth } from './sanitize-width.js';

describe('sanitizeWidth', () => {
  it('replaces a symbol with no fixed rendered width (★)', () => {
    expect(sanitizeWidth('release ★ candidate')).toBe('release ? candidate');
  });

  it('replaces an arbitrary non-Latin symbol seen in real session data', () => {
    // U+2442 (⑂) — the character found in a real session name on this
    // machine that motivated this module in the first place.
    expect(sanitizeWidth('fix-oversized-prompts-windows ⑂ investigate')).toBe(
      'fix-oversized-prompts-windows ? investigate',
    );
  });

  it('replaces emoji, the exact bug class already fixed by hand for curated icons', () => {
    expect(sanitizeWidth('deploy ⚡ fast')).toBe('deploy ? fast');
  });

  it('leaves plain ASCII text untouched', () => {
    expect(sanitizeWidth('cc-usage-monitor')).toBe('cc-usage-monitor');
  });

  it('leaves accented Spanish/European Latin text untouched', () => {
    // Regression test: a first version of this function filtered on
    // Unicode East Asian Width "Ambiguous" instead of script, and 'ó'/'ñ'
    // are themselves in that category — it mangled ordinary Spanish text
    // into question marks.
    expect(sanitizeWidth('sesión-cañón')).toBe('sesión-cañón');
  });

  it('leaves an empty string untouched', () => {
    expect(sanitizeWidth('')).toBe('');
  });

  it('replaces every unsafe character independently in mixed text', () => {
    expect(sanitizeWidth('a±b§c')).toBe('a?b?c');
  });
});
