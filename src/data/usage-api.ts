import type { ClaudeCredentials } from './credentials.js';

const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';
const TIMEOUT_MS = 5000;

export interface UsageWindow {
  /** 0-100. */
  utilization: number;
  resetsAt: Date | null;
}

export interface CreditsWindow extends UsageWindow {
  monthlyLimit: number | null;
  usedCredits: number | null;
  currency: string | null;
}

/** Which quota window a model-scoped limit lives in. `null` when the API doesn't say. */
export type LimitGroup = 'session' | 'weekly';

export interface ModelScopedWindow extends UsageWindow {
  displayName: string;
  group: LimitGroup | null;
}

export interface UsageSnapshot {
  fetchedAt: Date;
  subscriptionType: string | null;
  fiveHour: UsageWindow | null;
  sevenDay: UsageWindow | null;
  sevenDayOpus: UsageWindow | null;
  sevenDaySonnet: UsageWindow | null;
  credits: CreditsWindow | null;
  modelScoped: ModelScopedWindow[];
}

/**
 * `/api/oauth/usage` is undocumented. Confirmed live (2026-09-05, v2.1.261):
 * each window is `{ utilization: 0-100, resets_at: ISO 8601 | null, ... }`
 * at the response's top level — no `rate_limits` wrapper. `resets_at` is
 * also accepted as epoch seconds defensively, since the statusline-derived
 * fallback (snapshot.ts) uses that encoding for the same field.
 */
function toDate(value: unknown): Date | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Anything below year-10000-in-seconds is epoch seconds, not epoch ms.
    const ms = value < 1e12 ? value * 1000 : value;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function toPct(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, value));
}

function toWindow(raw: unknown): UsageWindow | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  const utilization = toPct(obj.utilization);
  if (utilization === null) return null;
  return { utilization, resetsAt: toDate(obj.resets_at) };
}

function toCredits(raw: unknown): CreditsWindow | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  if (obj.is_enabled !== true) return null;
  const utilization = toPct(obj.utilization);
  if (utilization === null) return null;
  return {
    utilization,
    resetsAt: null,
    monthlyLimit: typeof obj.monthly_limit === 'number' ? obj.monthly_limit : null,
    usedCredits: typeof obj.used_credits === 'number' ? obj.used_credits : null,
    currency: typeof obj.currency === 'string' ? obj.currency : null,
  };
}

function toGroup(value: unknown): LimitGroup | null {
  return value === 'session' || value === 'weekly' ? value : null;
}

/**
 * `limits[]` is the newer, self-describing list: confirmed live (2026-09-10)
 * that a per-model cap arrives here — `kind: 'weekly_scoped'`,
 * `group: 'weekly'`, `scope.model.display_name: 'Fable'` — and NOT as a
 * dedicated top-level key like `seven_day_opus`. `group` is what says which
 * window the cap belongs to, so it's kept rather than assumed weekly.
 */
function toModelScoped(raw: unknown): ModelScopedWindow[] {
  if (!Array.isArray(raw)) return [];
  const out: ModelScopedWindow[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue;
    const obj = entry as Record<string, unknown>;
    const scope = obj.scope as Record<string, unknown> | undefined;
    const model = scope?.model as Record<string, unknown> | undefined;
    const displayName = typeof model?.display_name === 'string' ? model.display_name : null;
    const utilization = toPct(obj.percent);
    if (!displayName || utilization === null) continue;
    out.push({
      displayName,
      group: toGroup(obj.group),
      utilization,
      resetsAt: toDate(obj.resets_at),
    });
  }
  return out;
}

export type UsageFetchResult =
  | { ok: true; snapshot: UsageSnapshot }
  | { ok: false; reason: 'no-credentials' | 'http-error' | 'parse-error' | 'network-error' };

/**
 * Reads a plain account-usage endpoint — it's what Claude Code's own /usage
 * command hits. Not an inference call: doesn't consume tokens and doesn't
 * count against either quota window.
 */
export async function fetchUsage(credentials: ClaudeCredentials): Promise<UsageFetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(USAGE_URL, {
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, reason: 'http-error' };

    const body = (await res.json()) as Record<string, unknown>;
    if (typeof body !== 'object' || body === null) return { ok: false, reason: 'parse-error' };

    return {
      ok: true,
      snapshot: {
        fetchedAt: new Date(),
        subscriptionType:
          typeof body.subscription_type === 'string' ? body.subscription_type : null,
        fiveHour: toWindow(body.five_hour),
        sevenDay: toWindow(body.seven_day),
        sevenDayOpus: toWindow(body.seven_day_opus),
        sevenDaySonnet: toWindow(body.seven_day_sonnet),
        credits: toCredits(body.extra_usage),
        modelScoped: toModelScoped(body.limits),
      },
    };
  } catch {
    return { ok: false, reason: 'network-error' };
  } finally {
    clearTimeout(timer);
  }
}
