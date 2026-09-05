import { describe, expect, it } from 'vitest';
import { age, resetAt, until } from './format.js';

describe('until', () => {
  const now = new Date('2026-09-05T12:00:00Z');

  it('returns null for a null target', () => {
    expect(until(null, now)).toBeNull();
  });

  it('returns null once the target has passed', () => {
    expect(until(new Date('2026-09-05T11:59:00Z'), now)).toBeNull();
  });

  it('formats minutes under an hour', () => {
    expect(until(new Date('2026-09-05T12:47:00Z'), now)).toBe('47m');
  });

  it('formats hours and minutes under a day', () => {
    expect(until(new Date('2026-09-05T14:14:00Z'), now)).toBe('2h14m');
  });

  it('formats days and hours', () => {
    expect(until(new Date('2026-09-10T14:00:00Z'), now)).toBe('5d2h');
  });
});

describe('resetAt', () => {
  it('shows only the time for today', () => {
    const now = new Date('2026-09-05T12:00:00');
    const target = new Date('2026-09-05T18:30:00');
    expect(resetAt(target, now)).toBe('18:30');
  });

  it('shows weekday, date and time for another day', () => {
    const now = new Date('2026-09-05T12:00:00');
    const target = new Date('2026-09-11T09:00:00');
    expect(resetAt(target, now)).toBe('vie 11/09 09:00');
  });

  it('returns null for a null target', () => {
    expect(resetAt(null)).toBeNull();
  });
});

describe('age', () => {
  const now = new Date('2026-09-05T12:00:00Z');

  it('returns null when never fetched', () => {
    expect(age(null, now)).toBeNull();
  });

  it('formats seconds', () => {
    expect(age(new Date('2026-09-05T11:59:48Z'), now)).toBe('12s');
  });

  it('formats minutes', () => {
    expect(age(new Date('2026-09-05T11:56:00Z'), now)).toBe('4m');
  });
});
