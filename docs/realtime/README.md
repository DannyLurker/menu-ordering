# Realtime Foundation + Rate Limiting — How It Wires Up

Transport is **Socket.IO only** (`socket.io` + `socket.io-client` in `package.json:30-31`). No SSE, Pusher, Supabase Realtime, Upstash, or Redis. One shared HTTP server (Next + API + sockets) boots from `server.ts` (`dev: tsx server.ts`). **Single instance only** — rooms and LRU counters live in local memory.

## 1. Core files

| What | Where |
|---|---|
| Shared contract (rooms, events, payload) | `lib/realtime.ts:1-144` |
| Server publish helper | `lib/realtime-server.ts:20-52` |
| Socket server + join verification | `server.ts:147-251` |
| Browser subscribe helper | `lib/realtime-client.ts:46-138` |
| Rate-limit store + keys | `lib/rate-limit.ts:1-121` |
| Edge passthrough for sockets | `proxy.ts:63-65` (`/api/auth/*`, `/api/stay-session/*` are public) |

## 2. Contract (`lib/realtime.ts`) — pure module, no Next/Node/DB

Rooms (derived server-side from verified sessions, never client claims):

```ts
import { KITCHEN_ROOM, stayRoom } from "@/lib/realtime";
stayRoom("stay-123"); // "stay:stay:stay-123"
KITCHEN_ROOM;         // "kitchen:board"
```

Events — clients emit joins/leaves only; only the server emits order state:

```ts
JOIN_STAY = "join.stay";  JOIN_KITCHEN = "join.kitchen";
LEAVE_STAY = "leave.stay"; LEAVE_KITCHEN = "leave.kitchen";
ORDER_CREATED = "order.created";
ORDER_STATUS_CHANGED = "order.status.changed";
JOIN_DENIED = "join.denied"; RATE_LIMIT_CODE = "RATE_LIMITED";
```

Payload (`OrderEventPayload: { stayId, orderId, status, etaMinutes }`) — ids + status + ETA only, no PIN/token. Build it with `buildOrderCreated({ stayId, orderId })` (always `PENDING/null`) or `buildOrderStatusChanged({ stayId, orderId, status, etaMinutes })`; both validate and throw on bad input. Join ack is `{ ok: true, room } | { ok: false, code, retryAfterSec }` via `joinDenied(code, retryAfterSec)`.

## 3. Publishing from route handlers (`lib/realtime-server.ts`)

Call **only after the REST write commits**. Before boot (build/prerender/tests) the helpers validate and return `false` instead of throwing.

```ts
import { emitOrderCreated, emitOrderStatusChanged } from "@/lib/realtime-server";

// POST /api/orders (after db insert commits):
emitOrderCreated({ stayId, orderId }); // fans order.created to stay room + kitchen room

// PATCH /api/orders/[id] (after status update commits):
emitOrderStatusChanged({ stayId, orderId, status: "PREPARING", etaMinutes: 10 });
```

Fanout is `live.to(stayRoom(stayId)).to(KITCHEN_ROOM).emit(event, payload)` (`realtime-server.ts:27-34`). Client-emitted `order.created` / `order.status.changed` are ignored and logged, never rebroadcast (`server.ts:241-246`).

## 4. Join verification (`server.ts:152-251`)

- `JOIN_STAY`: rate-check IP → `resolveStay(cookie)` (SHA-256 `stay_session` cookie → live `staySession` row, `ACTIVE` + not `pinLocked`) → rate-check stay → `socket.join(stayRoom(stayId))`.
- `JOIN_KITCHEN`: rate-check IP → `resolveStaff(cookie)` (Better Auth session, mirrors `proxy.ts`: valid role, not disabled/locked/`mustChangePassword`) → role must be `KITCHEN`/`ADMIN` → `socket.join(KITCHEN_ROOM)`.
- Denies answer the ack with `{ ok: false, code, retryAfterSec }` **and** emit `join.denied`; codes: `RATE_LIMITED`, `NO_SESSION`, `FORBIDDEN`.
- `LEAVE_STAY` / `LEAVE_KITCHEN` leave the resolved room. `setRealtimeServer(io)` at boot wires publish; `null` on shutdown (`server.ts:257-265`).

## 5. Subscribing from screens (`lib/realtime-client.ts`)

Screens own REST truth; events are refetch hints. The helper never fetches — you pass `refetch`.

```ts
import { createRealtimeClient } from "@/lib/realtime-client";

const rt = createRealtimeClient({
  onOrderEvent: (event, payload) => { /* e.g. invalidate query, toast */ },
  refetch: () => fetchOrders(),       // your REST read
  onResync: () => toast("Updated"),   // reconnect/focus heal (optional)
  onJoinDenied: ({ code, retryAfterSec }) => { /* show THROTTLE/LOCK copy */ },
});

rt.connect({ stay: true });    // guest screen — or { kitchen: true } for kitchen board
// ... on unmount:
rt.disconnect();
```

Behavior: joins on every `connect` (first load + reheals), rejoins + refetches on `focus` / `online` / `visibilitychange visible` (5s debounce `FOCUS_DEBOUNCE_MS`), `onResync` fires only on `reconnect`/`focus`. Handle `JOIN_DENIED` via `onJoinDenied`.

## 6. Rate limiting (`lib/rate-limit.ts`) — LRU speed, Postgres truth

In-memory `LRUCache(max: 5000, ttl: 15min)`. A restart clears counters but never the durable lock columns (`lockedUntil`, `pinLocked`). Budgets per 15-min window:

| Key fn | Budget | Used by |
|---|---|---|
| `signInAccountKey(email)` | `SIGN_IN_ACCOUNT_MAX = 5` | sign-in, kitchen socket join |
| `signInIpKey(ip)` | `SIGN_IN_IP_MAX = 20` | sign-in, kitchen socket join |
| `mintStayKey(stayId)` | `MINT_STAY_MAX = 5` | stay mint, stay socket join |
| `mintIpKey(ip)` | `MINT_IP_MAX = 20` | stay mint, stay socket join |
| `orderStayKey(stayId)` / `orderIpKey(ip)` | `20` / `60` | reserved, enforced by orders slice |

Functions — how to use each:

```ts
import { isRateLimited, hitRateLimit, takeBudget, resetRateLimit,
  rateLimitRetryAfter, rateLimitedResponse, clientIp,
  signInAccountKey, signInIpKey } from "@/lib/rate-limit";

// Standard REST pattern (probe BEFORE recording, so locked/inactive rows don't burn budget):
const ip = clientIp(headers);
if (isRateLimited(signInAccountKey(email), 5) || isRateLimited(signInIpKey(ip), 20))
  return rateLimitedResponse(rateLimitRetryAfter(signInAccountKey(email), 5));
hitRateLimit(signInAccountKey(email), 5);
hitRateLimit(signInIpKey(ip), 20);

// One-step alternative for new call sites:
const { allowed, retryAfterSec } = takeBudget(key, max);
if (!allowed) return rateLimitedResponse(retryAfterSec);

// Human-verified recovery (unlock flows) — clears the brute-force budget:
resetRateLimit(signInAccountKey(email)); // staff unlock: staff.service.ts:268-271
resetRateLimit(mintStayKey(stayId));     // stay unlock: stay-session.service.ts:160-167
```

- `isRateLimited(key, max)` — probe only. `hitRateLimit(key, max)` — record + verdict. `takeBudget` — probe+record, returns `{ allowed, retryAfterSec }`.
- `rateLimitRetryAfter(key, max)` — read-only seconds until oldest hit expires (use for the `retryAfter` hint / `Retry-After` header).
- `rateLimitedResponse(retryAfterSec, message?)` — uniform `429 { error: { code: RATE_LIMITED, message, retryAfter } }`. Default message is `THROTTLE_MESSAGE`; pass `LOCK_MESSAGE` for durable locks.
- `clientIp(headers)` — `x-forwarded-for[0]` → `x-real-ip` → `"unknown"`.

Wired today: sign-in (`app/api/auth/[...all]/route.ts:36-84`) layers LRU probe + durable 5-miss/15-min `lockedUntil`; stay mint (`app/api/stay-session/mint/route.ts:29-60`) layers LRU + durable 5-wrong-PIN `pinLocked`; socket joins (`server.ts:157-228`) reuse the same keys plus a per-socket probe key (`join:sock:{id}`) so pre-auth hammering doesn't dirty real budgets.

## 7. How to add …

- **New realtime event:** add the name + builder/validator to `lib/realtime.ts`, emit via a new `emitX` in `lib/realtime-server.ts` (call after commit), subscribe in `lib/realtime-client.ts` callbacks. Never accept order state from clients.
- **New rate-limited route:** pick/create a `*Key()` + `*_MAX`, probe with `isRateLimited` (or `takeBudget`), deny with `rateLimitedResponse(rateLimitRetryAfter(...))`, `resetRateLimit` in the matching human-unlock path.

## 8. Verify

- `pnpm vitest run lib/realtime.test.ts lib/realtime-server.test.ts lib/realtime-client.test.ts lib/rate-limit.test.ts`
- `pnpm tsx scripts/prove-realtime.ts`
- Spec: `docs/specs/0007-realtime-foundation/index.md` (single-instance consequence)
