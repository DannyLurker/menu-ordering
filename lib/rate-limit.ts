// Free rate limiting on LRU cache (specs 0001 and 0004). In memory speed
// with Postgres columns as the durable truth: a restart clears these
// counters but never the lockout columns. Single instance only.
import { LRUCache } from "lru-cache";

export const RATE_WINDOW_MS = 15 * 60 * 1000;
export const SIGN_IN_ACCOUNT_MAX = 5;
export const SIGN_IN_IP_MAX = 20;
export const MINT_STAY_MAX = 5;
export const MINT_IP_MAX = 20;

const hits = new LRUCache<string, number[]>({ max: 5000, ttl: RATE_WINDOW_MS });

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

export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}
