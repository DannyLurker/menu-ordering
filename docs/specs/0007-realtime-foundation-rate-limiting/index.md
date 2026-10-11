# 0007. Realtime foundation and rate limiting

**Date**: 2026-10-11
**Status**: Accepted

## Summary

This spec gives the hotel ordering app one shared live layer plus one shared limit layer. Order created plus status changed events travel through socket rooms scoped to each stay plus the kitchen board. Sign in plus PIN plus order create share in memory LRU budgets with durable columns as truth. Later slices build screens on these rooms and budgets instead of inventing their own.

## Requirements

**User stories**:

- As a guest, I want my order status plus ETA to update live with no refresh so I know when food arrives.
- As kitchen staff, I want new orders to appear at once so verification starts fast.
- As front desk staff, I want PIN retries limited and logged so brute force stays blunted without blocking legit guests.

**Acceptance criteria**:

- **AC-1**: An order create emits `order.created` into the kitchen room plus the owning stay room live with no refresh.
- **AC-2**: A status change plus ETA set emits `order.status.changed` into the same two rooms live with no refresh.
- **AC-3**: A stay room joins only on a live stay session for that stay id; the kitchen room joins only on a kitchen or admin staff session; server derives ids from sessions, never from client claim.
- **AC-4**: Only the server emits order events after a REST write succeeds; client emitted order state is never accepted or rebroadcast.
- **AC-5**: On reconnect plus on focus the client rejoins then refetches REST truth; socket stays a hint, REST stays truth.
- **AC-6**: Sign in plus stay mint plus PIN verify share LRU budgets of 5 per account or stay plus 20 per IP per 15 min; over budget answers 429 with retry after; Postgres columns stay truth across restarts.
- **AC-7**: Order create is capped at 20 per stay plus 60 per IP per 15 min; over budget answers 429 with retry after and the UI shows a wait plus call staff message on lock.
- **AC-8**: No PIN plus no token plus no password appears in logs or payloads; payloads carry ids plus status plus ETA only; errors stay generic.

## Decision

**Chosen option**: Option 1: stay plus kitchen rooms with server emit plus extended LRU budgets

You replace the demo socket map in `server.ts` with one room per stay plus one kitchen room, verify cookies at join time, emit only from the server after REST writes, and extend `lib/rate-limit.ts` with order create keys under the same helper shape.

**Implementation skills**: `nodejs-best-practices` (`.agents/skills/nodejs-best-practices/`) · `security-authz-and-trust-boundaries` (`.agents/skills/security-authz-and-trust-boundaries/`) · `security-client-server-boundary-and-secret-exposure` (`.agents/skills/security-client-server-boundary-and-secret-exposure/`) · `nextjs-data-fetching-and-cache` (`.agents/skills/nextjs-data-fetching-and-cache/`)

## Feature design

**Data model sketch**:

No new tables. This foundation reuses existing rows and keeps live state transient.

| Entity | Key fields | Relationships | Rules |
|---|---|---|---|
| **Stay** (existing) | `id`, `checkOut`, `pinHash`, `failedPinAttempts`, `lockedUntil` | 1 to N `Order`; 1 to N `StaySession` | Stay validity decided in spec 0002; lockout counted here |
| **Order** (existing) | `id`, `stayId` FK, `status`, `etaMinutes` | N to 1 `Stay` | Status set PENDING, PREPARING, READY, SERVED, GUEST_CANCELLED, KITCHEN_CANCELLED |
| **StaySession** (spec 0004) | `id`, `stayId` FK, `tokenHash` unique, `expiresAt`, `revoked` | N to 1 `Stay` | One live row per stay; live means not revoked plus not expired |
| **User** (staff, spec 0004) | `id`, `role`, `failedSignInAttempts`, `lockedUntil`, `mustChangePassword`, `isDisabled` | 1 to N `Session` | Role gates kitchen room; disabled plus must change deny before join |
| **Transient room membership** (memory only) | `socketId`, `roomName`, `joinedAt` | None persisted | Dies on disconnect; server derives room from verified session |
| **Transient LRU hits** (memory only) | key lists with timestamps, 15 min window | None persisted | Restart clears speed layer only; columns stay truth |

**State transitions**:

Socket: CONNECTED to JOINED (join check passes) to REJOINING (drop) to JOINED again (rejoin plus refetch). JOINED to LEFT (explicit leave or disconnect). Denied joins never reach JOINED.

StaySession plus staff lock states stay as decided in spec 0004; this spec only reads them.

**How the feature works**:

1. Guest verifies stay PIN through REST mint and holds the `stay_session` cookie; staffer signs in and holds the BetterAuth cookie.
2. Browser opens a socket with the official client in auto mode with polling fallback; same origin only, one shared HTTP server handles pages plus APIs plus sockets.
3. Client emits `join.stay` or `join.kitchen` with no ids; server reads the cookie, resolves the stay or role, derives the room name (`stay:stay:{stayId}` or the fixed `kitchen:board`), and joins on pass or denies with a limited or forbidden code on fail.
4. Guest creates an order through REST; kitchen verifies through REST; after each write succeeds the server emits `order.created` or `order.status.changed` with ids plus status plus ETA into the owning stay room plus the kitchen room.
5. Clients treat events as hints and refetch the REST order or board; on reconnect plus on focus they rejoin then refetch and show a subtle updated note.
6. Every limited write checks the shared LRU helper first; over budget gets 429 with retry after for REST or a deny code with the same shape for socket joins; success plus human verified unlock resets through the same helper.
7. Logs record joins, denies, emits, and limit hits with stay plus order ids plus role only; secrets never logged.

**API surface**:

Socket events (server emits order state; clients emit join only):

| Event | Direction | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `join.stay` | client to server | none, cookie only | room `stay:stay:{stayId}` | live stay session | 401 no session, 429 limited |
| `join.kitchen` | client to server | none, cookie only | room `kitchen:board` | kitchen or admin session | 403 wrong role, 429 limited |
| `leave.stay` / `leave.kitchen` | client to server | none | ok | joined member | none |
| `order.created` | server to room | payload `{ stayId, orderId, status: PENDING }` | fanned to stay room plus kitchen room | server only | never from client; client emit ignored plus logged |
| `order.status.changed` | server to room | payload `{ stayId, orderId, status, etaMinutes }` with `etaMinutes` in minutes, null until set; status one of PENDING, PREPARING, READY, SERVED, GUEST_CANCELLED, KITCHEN_CANCELLED | fanned to stay room plus kitchen room | server only | never from client; client emit ignored plus logged |

REST truth (owned by later slices; this foundation only constrains them):

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| order create (slice 7) | POST | items, stay session cookie | order id, status | stay session | 401 wrong PIN path, 429 over cap |
| order verify plus ETA (slice 8) | POST | orderId, etaMinutes | status PREPARING | kitchen or admin | 403 wrong role, 429 over cap |
| order read / board read | GET | stay or board scope | order plus ETA | stay session or staff | 401 expired session |

Limit reply shape everywhere: HTTP 429 carries `{ code: RATE_LIMITED, retryAfter, message }` with a generic message; socket join deny carries the same code plus retry after; UI maps the code to a wait message and, on PIN or stay lock, to a call staff message. Join budgets match REST budgets: 5 per stay or account plus 20 per IP per 15 min for joins; order create uses 20 per stay plus 60 per IP per 15 min. Limited hits never increment durable fail columns, only LRU; durable locks come only from real mismatches. Default EN copy (ID text waits for the localization spec): throttle shows "Please wait a moment and try again." and lock shows "Locked. Please call staff for help."

Refetch contract (foundation names it, later slices own the URLs): on reconnect plus on focus the client rejoins then GETs the REST order or board owned by slices 7, 8, and 11; at most 3 tries with backoff plus jitter; focus refetch debounced to 5s; subtle note shows "Updated just now" for 3s.

**Value sourcing**:

| Action | Value produced or displayed | Source |
|---|---|---|
| Join stay | room name `stay:stay:{stayId}` | derived server side from `StaySession.stayId`, never client input |
| Join kitchen | room name `kitchen:board` | fixed literal in server code |
| Emit created | stayId, orderId, status PENDING | `Order.stayId`, `Order.id`, `Order.status` columns |
| Emit changed | stayId, orderId, status, etaMinutes | `Order.stayId`, `Order.id`, `Order.status`, `Order.etaMinutes` columns |
| Refetch truth | order plus ETA shown on screen | REST read of `Order` row after each hint |
| Allow or deny | join decision | `StaySession` liveness (not revoked plus not expired plus stay ACTIVE plus not locked) plus `User.role` (KITCHEN or ADMIN for kitchen room) plus `isDisabled` plus `mustChangePassword` plus `lockedUntil`; socket reads the `stay_session` cookie through the same hash lookup as REST mint and the staff session through BetterAuth getSession |
| Throttle sign in | allow plus 429 | LRU keys `signin:acct:{email}` (email lowercased plus trimmed) plus `signin:ip:{ip}`, budgets 5 plus 20 per 15 min; counted on every checked request, reset on success |
| Throttle mint | allow plus 429 | LRU keys `mint:stay:{stayId}` plus `mint:ip:{ip}`, budgets 5 plus 20 per 15 min; stay key used only after cookie resolve, pre auth joins keyed by socket id |
| Throttle create | allow plus 429 | LRU keys `order:stay:{stayId}` plus `order:ip:{ip}`, budgets 20 plus 60 per 15 min; denied plus limited hits skip durable columns |
| Throttle join | allow plus deny code | same budgets as sign in and mint: 5 per stay or account plus 20 per IP per 15 min |
| Retry hint | retry after seconds | computed from oldest hit inside window by the helper |
| Lock truth | cooldown across restarts | `Stay.lockedUntil` plus `User.lockedUntil` columns |
| Log lines | join, deny, emit, limit hit | console structured logs through one redacting helper; allowed fields are stay plus order plus socket ids plus role only; deny list is PIN plus token plus password plus cookie value |
| Client IP | per IP budget key | `x-forwarded-for` first entry else `x-real-ip` else unknown, via `clientIp` helper; single proxy hop trusted in V1.1, header spoof noted in Consequences |

**Key invariants**:

- Room names are derived server side from verified sessions; client supplied ids never choose a room.
- Only the server emits `order.created` plus `order.status.changed`, and only after the REST write commits; a client emitted order event is ignored plus logged with socket id only, never rebroadcast and never disconnects the socket.
- At most one live stay session per stay still holds; joins check liveness on every join.
- LRU holds speed, Postgres holds truth; a restart never clears a lock column.
- PINs plus tokens plus passwords never enter logs or payloads; errors stay generic.
- Single instance only in V1.1; rooms plus LRU are local, a second host would split them.
- REST is truth and socket is a hint; every screen loads REST first with loading plus empty plus error states.

**Security model**:

Stay rooms admit only the live stay session for that stay id. Kitchen room admits only kitchen plus admin roles with an active session; desk cannot join or emit verify; disabled plus must change plus locked staff deny before join. Guests reach only their own stay room; staff reach the kitchen room plus, for support, named stay rooms only when a later slice explicitly grants it (not in this foundation). Sign in plus mint plus create share the LRU limiter with 429 on cap and durable lock columns behind it. Stay cookie stays `stay_session` with HTTP only plus Secure plus SameSite Lax. No card data anywhere; compliance scope stays staff emails plus guest names only.

**Configuration required**:

No new env vars. Reuses `PORT` (default 3000, one shared server for pages plus sockets), `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, plus `SEED_ADMIN_EMAIL` plus `SEED_ADMIN_PASSWORD` from spec 0004.

**Library permissions**:

Log for working agreement 1 (every outside download needs prior approval):

- `socket.io` 4.8.x plus `socket.io-client` 4.8.x: already approved through spec 0001; this spec uses both, no new request.
- `lru-cache` 11.x: already approved through spec 0001; this spec extends its use, no new request.
- No new outside packages in this spec. If a shared pub sub or a ticket vendor is ever proposed for multi host, that needs a fresh request plus a new spec.

**Critical test scenarios**:

- Happy path: order create fans `order.created` to kitchen plus owning stay only, other stays get nothing, verifies **AC-1, AC-3**.
- Happy path: verify with ETA fans `order.status.changed` with status plus ETA to the same two rooms, verifies **AC-2**.
- Failure case: drop plus reconnect rejoins then refetches and shows current truth with no stale write, verifies **AC-5**.
- Failure case: six rapid mints trip LRU then 429 with retry after while columns keep the lock across restart, verifies **AC-6**.
- Failure case: burst creates over 20 per stay trip 429 with retry after and call staff copy, verifies **AC-7**.
- Auth case: desk cookie denied kitchen join with 403; foreign stay cookie denied other stay room; client emitted order event ignored, verifies **AC-3, AC-4**.
- Secret case: logs plus payloads scanned for PIN plus token plus password strings, none found, verifies **AC-8**.

## Build plan

Ordered by Tracer Bullet (thin live thread first through server plus emit plus client, then limits, then proof).

1. Replace demo map in `server.ts` with stay plus kitchen rooms and cookie join checks with deny codes, satisfies **AC-1, AC-3**.
2. Add server emit helper called after REST order writes with ids plus status plus ETA payloads and client emit rejection, satisfies **AC-4, AC-1, AC-2**.
3. Add browser join helper with auto reconnect plus polling fallback and rejoin plus refetch on reconnect and focus, satisfies **AC-5**.
4. Extend `lib/rate-limit.ts` with order create keys (`order:stay:{stayId}`, `order:ip:{ip}`, 20 plus 60 per 15 min) plus uniform 429 with retry after plus socket deny mapping, satisfies **AC-6, AC-7**.
5. Apply log redaction plus payload shape plus prove walk (kitchen plus guest live walk plus limit walk plus secret scan), satisfies **AC-8, AC-1 to AC-7**.
6. Document the single instance limit plus room naming plus budget table where later slices can find it, satisfies **AC-3, AC-6, AC-7**.

## Migration plan

**Strategy**: big bang for the socket demo only (no prod traffic, demo chat retired in one commit)
**Phases**:
1. Land rooms plus emit helper plus client join helper behind no flag; demo `register_user` plus `private_message` handlers removed in the same commit.
2. Land extended limiter plus 429 shape; prove walk passes before merge.
**Rollback**: revert the one commit; demo handlers return with the revert.
**Risks**: a later slice already imports the demo handlers (check imports before landing); socket clients cached on old event names (bump with the emit helper in the same release).

## Planned feature workflow

Plan, build with `/develop`, prove with `/check verify` (live fanout to right rooms plus rejoin refetch plus 429 walks pass, build passes), cover with `/test`, review with a fresh model `/check review`, note with `/document`. Spec status moves Proposed to In Progress to Accepted as the scope row moves. `/develop` updates this plan to match what was built.

## Consequences

**Positive**:

- One room plus emit plus limit pattern every later slice reuses with no per slice invention.
- Server emit only plus cookie derived rooms close spoof plus cross stay leak by construction.
- REST as truth keeps screens correct through drops with no replay store to operate.

**Negative / tradeoffs**:

- Single instance only; rooms plus LRU are local, horizontal scale needs a pub sub plus shared limiter later.
- Order create cap can throttle a legit burst (family ordering at once); retry copy softens but does not remove the friction.
- Join check only (no per emit reverify) trusts membership between join and leave; revoke needs explicit disconnect to take effect fast.
- IP caps trust one proxy hop; a spoofed forwarding header can inflate or dodge per IP counts, so per stay and per account caps stay the binding limits.
- Reconnect plus focus refetches use backoff plus jitter plus a 5s focus debounce so a mass reconnect never storms REST at once.
- A restart clears burst caps but never lock columns; a burst right before a restart gets a fresh burst budget after it.

**Neutral**:

- Guest PIN hashing stays in spec 0005; staff password seams stay in spec 0006; this spec only reads their columns.
- No new tables and no new env vars; later slices add order write routes that call the emit helper.
- Polling fallback stays on for hotel wifi at the cost of extra transports to observe.

## Follow-up

- [ ] Slice 7 plus Slice 8 must call the emit helper after commit and map 429 to wait plus call staff copy.
- [ ] Revoke fast path: on checkout plus PIN lock plus staff disable, disconnect that stay or staff sockets at once (not yet in plan).
- [ ] Multi host later: shared pub sub plus shared limiter need a fresh spec when a second host is real.
- [ ] Shared React hook for join plus refetch plus empty plus error states is deferred to the first consuming slice.
- [ ] Library permission log per working agreement 1 lives in this spec under Feature design.

## Rationale

Reasoning and options: see `rationale.md`.
