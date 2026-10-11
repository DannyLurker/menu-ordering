// Free rate limiting on LRU cache (specs 0001 and 0004). In memory speed
// with Postgres columns as the durable truth: a restart clears these
// counters but never the lockout columns. Single instance only.
import { LRUCache } from "lru-cache";
import { RATE_LIMIT_CODE, THROTTLE_MESSAGE } from "./realtime";

export const RATE_WINDOW_MS = 15 * 60 * 1000;
export const SIGN_IN_ACCOUNT_MAX = 5;
export const SIGN_IN_IP_MAX = 20;
export const MINT_STAY_MAX = 5;
export const MINT_IP_MAX = 20;
export const ORDER_STAY_MAX = 20;
export const ORDER_IP_MAX = 60;
export const PINSETUP_STAY_MAX = 5;
export const PINSETUP_IP_MAX = 20;
export const RATE_HOUR_MS = 60 * 60 * 1000;
export const REISSUE_HOUR_MAX = 20;

const hits = new LRUCache<string, number[]>({ max: 5000, ttl: RATE_WINDOW_MS });
const hourHits = new LRUCache<string, number[]>({ max: 2000, ttl: RATE_HOUR_MS });

function prune(key: string, now: number): number[] {
  const cutoff = now - RATE_WINDOW_MS;
  const kept = (hits.get(key) ?? []).filter((t) => t > cutoff);
  hits.set(key, kept);
  return kept;
}

/** Record one hit and report whether the key is still within budget. */
export function hitRateLimit(key: string, max: number): { allowed: boolean } {
  const kept = prune(key, Date.now());
  kept.push(Date.now());
  hits.set(key, kept);

  return { allowed: kept.length <= max };
}

/** True when the key already spent its budget, without recording a hit. */
export function isRateLimited(key: string, max: number): boolean {
  return prune(key, Date.now()).length >= max;
}

/**
 * Clear one key's budget. Human verified recovery (stay unlock, staff
 * unlock) resets the counter so a legit retry is never stuck behind the
 * brute force budget that caused the lock.
 */
export function resetRateLimit(key: string): void {
  hits.delete(key);
}

export function signInAccountKey(email: string): string {
  return `signin:acct:${email.trim().toLowerCase()}`;
}

export function signInIpKey(ip: string): string {
  return `signin:ip:${ip}`;
}

export function mintStayKey(stayId: string): string {
  return `mint:stay:${stayId}`;
}

export function mintIpKey(ip: string): string {
  return `mint:ip:${ip}`;
}

export function orderStayKey(stayId: string): string {
  return `order:stay:${stayId}`;
}

export function orderIpKey(ip: string): string {
  return `order:ip:${ip}`;
}

export function pinSetupStayKey(stayId: string): string {
  return `pinsetup:stay:${stayId}`;
}

export function pinSetupIpKey(ip: string): string {
  return `pinsetup:ip:${ip}`;
}

export function reissueDeskKey(stayId: string): string {
  return `reissue:stay:${stayId}`;
}

export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Seconds until the key's oldest hit leaves the window, or 0 when under
 * budget. Read only: it never records a hit, so a deny can report retry
 * timing without spending more budget.
 */
export function rateLimitRetryAfter(key: string, max: number): number {
  const kept = prune(key, Date.now());
  if (kept.length < max) return 0;
  const oldest = kept[0];
  return Math.max(1, Math.ceil((oldest + RATE_WINDOW_MS - Date.now()) / 1000));
}

/**
 * Probe then record in one step for new call sites. Returns allow plus
 * the retry hint together so every limited answer carries timing.
 */
/**
 * Probe then record in one step for new call sites. Returns allow plus
 * the retry hint together so every limited answer carries timing.
 */
export function takeBudget(
  key: string,
  max: number,
): { allowed: boolean; retryAfterSec: number } {
  if (isRateLimited(key, max)) {
    return { allowed: false, retryAfterSec: rateLimitRetryAfter(key, max) };
  }
  hitRateLimit(key, max);
  return { allowed: true, retryAfterSec: 0 };
}

/**
 * Hourly probe then record for slow desk budgets (spec 0008 reissue).
 * Runs on its own hour window bucket, apart from the 15 minute buckets.
 */
export function takeHourBudget(key: string, max: number): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const cutoff = now - RATE_HOUR_MS;
  const kept = (hourHits.get(key) ?? []).filter((t) => t > cutoff);
  if (kept.length >= max) {
    const oldest = kept[0];
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((oldest + RATE_HOUR_MS - now) / 1000)) };
  }
  kept.push(now);
  hourHits.set(key, kept);
  return { allowed: true, retryAfterSec: 0 };
}

/**
 * Uniform limited answer (spec 0007 AC-6, AC-7). Same shape for REST and
 * socket joins: stable code plus retry seconds plus UI copy, with the
 * Retry After header so generic HTTP clients also back off. Pass the
 * lock copy for durable locks, the throttle copy for spent budgets.
 */
export function rateLimitedResponse(
  retryAfterSec: number,
  message: string = THROTTLE_MESSAGE,
): Response {
  return Response.json(
    { error: { code: RATE_LIMIT_CODE, message, retryAfter: retryAfterSec } },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    },
  );
}
