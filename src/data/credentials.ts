import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CREDENTIALS_PATH = join(homedir(), '.claude', '.credentials.json');

export interface ClaudeCredentials {
  accessToken: string;
  subscriptionType: string | null;
}

interface CredentialsFile {
  claudeAiOauth?: {
    accessToken?: string;
    subscriptionType?: string | null;
  };
}

/**
 * Re-reads ~/.claude/.credentials.json on every call — Claude Code itself
 * keeps the access token refreshed on disk, so we never refresh it
 * ourselves. Returns null on any read/parse failure (missing file, mid-write
 * truncation, logged out) so the caller can fall back cleanly.
 */
export async function readCredentials(): Promise<ClaudeCredentials | null> {
  try {
    const raw = await readFile(CREDENTIALS_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as CredentialsFile;
    const accessToken = parsed.claudeAiOauth?.accessToken;
    if (!accessToken) return null;
    return {
      accessToken,
      subscriptionType: parsed.claudeAiOauth?.subscriptionType ?? null,
    };
  } catch {
    return null;
  }
}
