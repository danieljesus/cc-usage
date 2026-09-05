import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', () => ({ readFile: vi.fn() }));

import { readFile } from 'node:fs/promises';
import { readCredentials } from './credentials.js';

beforeEach(() => {
  vi.mocked(readFile).mockReset();
});

describe('readCredentials', () => {
  it('parses a well-formed credentials file', async () => {
    vi.mocked(readFile).mockResolvedValue(
      JSON.stringify({ claudeAiOauth: { accessToken: 'tok_abc', subscriptionType: 'pro' } }),
    );
    expect(await readCredentials()).toEqual({ accessToken: 'tok_abc', subscriptionType: 'pro' });
  });

  it('defaults subscriptionType to null when absent', async () => {
    vi.mocked(readFile).mockResolvedValue(
      JSON.stringify({ claudeAiOauth: { accessToken: 'tok_abc' } }),
    );
    expect(await readCredentials()).toEqual({ accessToken: 'tok_abc', subscriptionType: null });
  });

  it('returns null when there is no access token', async () => {
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ claudeAiOauth: {} }));
    expect(await readCredentials()).toBeNull();
  });

  it('returns null when claudeAiOauth is missing entirely', async () => {
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({}));
    expect(await readCredentials()).toBeNull();
  });

  it('returns null when the file does not exist (logged out)', async () => {
    vi.mocked(readFile).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    expect(await readCredentials()).toBeNull();
  });

  it('returns null on malformed JSON (mid-write truncation)', async () => {
    vi.mocked(readFile).mockResolvedValue('{"claudeAiOauth": {"acce');
    expect(await readCredentials()).toBeNull();
  });
});
