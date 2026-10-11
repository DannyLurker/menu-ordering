# 0010. Kitchen live board with verify and ETA

**Date**: 2026-10-11
**Status**: Proposed

## Summary

Kitchen staff see every incoming order on a live board that updates in real time through websocket events already built in spec 0007. The board lets kitchen verify a PENDING order into PREPARING by entering an estimated time in minutes, then advance it through READY to SERVED, or cancel it with a reason. A live countdown shows time remaining per order and turns urgent when overdue. Front desk can view the board read only.

## Requirements

**User stories**:
* As kitchen staff, I want new orders to appear on my board at once with no refresh so I can start preparation quickly.
* As kitchen staff, I want to verify a pending order and enter an estimated time so the guest knows when food arrives.
* As kitchen staff, I want to update the estimated time on a preparing order if circumstances change.
* As kitchen staff, I want to mark an order ready or served so the guest and front desk see current status.
* As kitchen staff, I want to cancel an order with a reason so the guest knows why and what to do next.
* As a front desk agent, I want to view the kitchen board read only so I can answer guest questions about their order.

**Acceptance criteria**:
* **AC-1**: Kitchen and admin staff see the live board at `/kitchen` with two columns: a PENDING column (oldest first) and a PREPARING column (soonest ETA first). READY and SERVED orders from the last 2 hours show in a collapsible completed strip at the bottom.
* **AC-2**: `GET /api/kitchen/orders` returns active orders (PENDING plus PREPARING) with items, room number, placed time, and ETA, plus optionally recent completed orders. Requires kitchen, admin, or front desk session. Front desk gets read only access (no mutation endpoints).
* **AC-3**: `POST /api/kitchen/orders/[id]/verify` transitions PENDING to PREPARING, requires `etaMinutes` (integer 1 to 120), sets `verifiedAt` to now and `verifiedBy` to the acting staff user id, and emits `order.status.changed` to the stay room plus kitchen room. Returns 409 if the order is not PENDING.
* **AC-4**: `PATCH /api/kitchen/orders/[id]/eta` updates `etaMinutes` (1 to 120) on a PREPARING order and emits `order.status.changed` with the new ETA. Returns 409 if the order is not PREPARING.
* **AC-5**: `POST /api/kitchen/orders/[id]/ready` transitions PREPARING to READY and emits `order.status.changed`. Returns 409 if the order is not PREPARING.
* **AC-6**: `POST /api/kitchen/orders/[id]/served` transitions READY to SERVED, sets `servedAt` to now, and emits `order.status.changed`. Returns 409 if the order is not READY.
* **AC-7**: `POST /api/kitchen/orders/[id]/cancel` transitions PENDING or PREPARING to KITCHEN_CANCELLED, requires a `reason` (text, 1 to 200 chars), sets `cancelReason` and `cancelledBy`, and emits `order.status.changed`. Returns 409 if the order is already in a terminal state.
* **AC-8**: Each order card on the board shows the room number prominently, item names in English and Indonesian, quantities, and a live countdown timer computed from `verifiedAt` plus `etaMinutes`. The countdown shows visual urgency (color change) when under 5 minutes or overdue.
* **AC-9**: When a new order arrives (the `order.created` event), the board plays an audio chime and shows a toast notification. The audio requires one user interaction on the page to unlock (browser autoplay restriction).
* **AC-10**: On websocket disconnect and reconnect, the board refetches from `GET /api/kitchen/orders` (using the existing realtime client rejoin and refetch pattern from spec 0007) and shows a subtle "Reconnected" toast.
* **AC-11**: All kitchen mutation endpoints enforce rate limits using `kitchenStaffKey(userId)` (20 per 15 min) and `kitchenIpKey(ip)` (60 per 15 min), returning 429 with `Retry-After`.
* **AC-12**: Board and API labels are bilingual (English and Indonesian). Empty state shows "No active orders right now" / "Tidak ada pesanan aktif saat ini". Error state shows a retry button.
* **AC-13**: Invalid state transitions return 409 Conflict with the current order status and a bilingual message. The board refetches and updates on 409 to show the current state.
* **AC-14**: The board route `/kitchen` requires kitchen or admin role for mutations. Front desk can open the board read only (no verify, ETA, ready, served, or cancel controls). This feature updates `proxy.ts`, the kitchen page gate, and `join.kitchen` authorization so front desk can reach the page and subscribe to the kitchen room (spec 0007 currently denies desk on kitchen join; extend join checks here, do not change mutation auth).

## Decision

**Chosen option**: Option 1: REST mutations with server side socket emit plus column based board with client countdown

Kitchen staff advance orders through the full lifecycle via REST endpoints. Each successful write emits `order.status.changed` through the existing realtime layer (spec 0007). The board is a client component that joins the `kitchen:board` room, listens for events, and refetches REST truth on each hint. Countdown timers tick locally from `verifiedAt` plus `etaMinutes`.

**Implementation skills**: `nextjs-app-router-patterns` (`.agents/skills/nextjs-app-router-patterns/`) · `nextjs-server-actions-and-route-handlers` (`.agents/skills/nextjs-server-actions-and-route-handlers/`) · `nodejs-best-practices` (`.agents/skills/nodejs-best-practices/`) · `security-authz-and-trust-boundaries` (`.agents/skills/security-authz-and-trust-boundaries/`)

## Rationale

Reasoning and options: see rationale.md.

## Feature design

**Data model sketch**:

Order (updated, three new nullable fields added by migration):

| Field | Type | Required | Rules |
|---|---|---|---|
| id | uuid PK | yes | existing |
| stayId | uuid FK to Stay | yes | existing |
| status | OrderStatus enum | yes | existing: PENDING, PREPARING, READY, SERVED, GUEST_CANCELLED, KITCHEN_CANCELLED |
| etaMinutes | Int? | no | 1 to 120 via CHECK constraint (was 5 to 120, widened), null until verify, updatable while PREPARING |
| placedAt | DateTime | yes | existing, default now |
| verifiedAt | DateTime? | no | existing, set when PENDING to PREPARING |
| servedAt | DateTime? | no | existing, set when to SERVED |
| cancelReason | String? | no | **new**, max 200 chars via CHECK constraint, set on KITCHEN_CANCELLED |
| verifiedBy | String? FK to User(id) | no | **new**, set on verify |
| cancelledBy | String? FK to User(id) | no | **new**, set on cancel |

Stay (existing, read only in this feature):
* roomNumber (text): displayed on each order card.
* Other fields unchanged.

MenuItem (existing, read only): nameEn, nameId displayed on order cards.

**State transitions**:

Order lifecycle (kitchen board owns all transitions after PENDING):
* PENDING to PREPARING: kitchen/admin verifies with etaMinutes (1 to 120). Sets `verifiedAt`, `verifiedBy`.
* PREPARING to READY: kitchen/admin marks ready.
* READY to SERVED: kitchen/admin marks served. Sets `servedAt`.
* PENDING to KITCHEN_CANCELLED: kitchen/admin cancels with reason. Sets `cancelReason`, `cancelledBy`.
* PREPARING to KITCHEN_CANCELLED: kitchen/admin cancels with reason. Sets `cancelReason`, `cancelledBy`.

Terminal states: SERVED, GUEST_CANCELLED, KITCHEN_CANCELLED. No backward transitions. READY cannot return to PREPARING.

**How the feature works** (per working agreement 4):
1. Guest places an order through `/guest/menu` (spec 0009). Order arrives as PENDING.
2. Server emits `order.created` to the kitchen room. Board receives the event.
3. Board plays an audio chime and shows a toast. The new order appears in the PENDING column.
4. Kitchen staff clicks verify on the order card and enters an ETA (1 to 120 minutes).
5. System calls `POST /api/kitchen/orders/[id]/verify` with `etaMinutes`. Server validates, updates status to PREPARING, sets `verifiedAt` and `verifiedBy`, emits `order.status.changed`.
6. Board moves the order to the PREPARING column. A live countdown timer starts from `verifiedAt + etaMinutes`.
7. If needed, kitchen updates ETA via `PATCH /api/kitchen/orders/[id]/eta`. Board updates the countdown.
8. When food is ready, kitchen clicks "Ready". System calls `POST /api/kitchen/orders/[id]/ready`, updates status, emits event. Card moves to completed strip.
9. When food is served, kitchen clicks "Served". System calls `POST /api/kitchen/orders/[id]/served`, sets `servedAt`, emits event.
10. To cancel, kitchen clicks "Cancel", enters a reason. System calls `POST /api/kitchen/orders/[id]/cancel`, sets `cancelReason` and `cancelledBy`, emits event.

**Planned workflow** (per working agreement 2):
1. Order placed by guest triggers `order.created` event to kitchen room.
2. Board auto refreshes from REST on each socket event as hint.
3. Kitchen staff verifies order by entering ETA in modal dialog.
4. System validates role, validates order is PENDING, persists PREPARING status with timestamps.
5. System emits `order.status.changed` to stay room and kitchen room.
6. Board updates, countdown starts. Guest sees live status update (future Feature 11).
7. Kitchen advances through READY and SERVED, or cancels with reason.
8. Each transition emits event, board refetches, guest notified.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| /api/kitchen/orders | GET | `?include=completed` (optional, includes READY/SERVED from last 2h) | orders array with id, stayId, roomNumber, status, etaMinutes, placedAt, verifiedAt, servedAt, cancelReason, items array (id, nameEn, nameId, qty, unitPrice) | kitchen/admin/front desk session | 401 unauthenticated, 403 wrong role |
| /api/kitchen/orders/[id]/verify | POST | etaMinutes: int (1 to 120, required) | orderId, status: PREPARING, verifiedAt, etaMinutes | kitchen/admin session | 401 unauth, 403 wrong role, 404 order not found, 409 not PENDING, 429 rate limited |
| /api/kitchen/orders/[id]/eta | PATCH | etaMinutes: int (1 to 120, required) | orderId, status, etaMinutes | kitchen/admin session | 401 unauth, 403 wrong role, 404 not found, 409 not PREPARING, 429 rate limited |
| /api/kitchen/orders/[id]/ready | POST | none | orderId, status: READY | kitchen/admin session | 401 unauth, 403 wrong role, 404 not found, 409 not PREPARING, 429 rate limited |
| /api/kitchen/orders/[id]/served | POST | none | orderId, status: SERVED, servedAt | kitchen/admin session | 401 unauth, 403 wrong role, 404 not found, 409 not READY, 429 rate limited |
| /api/kitchen/orders/[id]/cancel | POST | reason: string (1 to 200 chars, required) | orderId, status: KITCHEN_CANCELLED, cancelReason | kitchen/admin session | 401 unauth, 403 wrong role, 404 not found, 409 terminal state, 429 rate limited |

**Value sourcing**:

| Action | Value produced or displayed | Source |
|---|---|---|
| Board load | list of active orders | DB query: Order where status in (PENDING, PREPARING) joined with Stay.roomNumber and OrderItem with MenuItem names; PENDING sorted by placedAt ascending; PREPARING sorted by `(verifiedAt + etaMinutes)` ascending (soonest finish first) |
| Board load | completed orders (optional) | DB query: Order where status in (READY, SERVED) and verifiedAt within last 2 hours |
| Verify order | verifiedAt | Application timestamp (now) set at transition time |
| Verify order | verifiedBy | Staff user id from BetterAuth session via `requireStaffRole` |
| Verify order | etaMinutes | Request body input, validated 1 to 120 |
| Verify order | status PREPARING | Hardcoded OrderStatus.PREPARING on valid transition |
| Update ETA | etaMinutes | Request body input, validated 1 to 120 |
| Mark ready | status READY | Hardcoded OrderStatus.READY on valid transition |
| Mark served | servedAt | Application timestamp (now) at transition time |
| Mark served | status SERVED | Hardcoded OrderStatus.SERVED |
| Cancel order | cancelReason | Request body input, validated 1 to 200 chars |
| Cancel order | cancelledBy | Staff user id from BetterAuth session |
| Cancel order | status KITCHEN_CANCELLED | Hardcoded OrderStatus.KITCHEN_CANCELLED |
| Countdown display | remaining minutes | Client computed: `(verifiedAt + etaMinutes * 60000 - Date.now()) / 60000` |
| Countdown urgency | color state | Client computed: red if remaining <= 0 (overdue), orange if remaining <= 5 |
| Order card | room number | DB column Stay.roomNumber joined through Order.stayId |
| Order card | item names | DB columns MenuItem.nameEn and MenuItem.nameId joined through OrderItem.menuItemId |
| Audio chime | sound | Bundled .mp3 file played via Web Audio API on `order.created` event |
| Toast notification | message | Hardcoded bilingual string: "New order from Room {roomNumber}" / "Pesanan baru dari Kamar {roomNumber}" |
| Reconnect toast | message | Hardcoded bilingual string: "Reconnected" / "Terhubung kembali" |
| Empty state | message | Hardcoded bilingual: "No active orders right now" / "Tidak ada pesanan aktif saat ini" |

**Key invariants**:
* An order can only advance forward through the status lifecycle: PENDING to PREPARING to READY to SERVED. No backward transitions.
* Cancel (KITCHEN_CANCELLED) is allowed only from PENDING or PREPARING, never from READY, SERVED, or GUEST_CANCELLED.
* `etaMinutes` is required when verifying (PENDING to PREPARING) and must be between 1 and 120.
* `cancelReason` is required when cancelling and must be between 1 and 200 characters.
* `verifiedBy` and `cancelledBy` are always set from the server side session, never from client input.
* Every status mutation emits `order.status.changed` through the realtime layer after the database write commits. The emit fans to both the owning stay room and the kitchen room.
* The board treats socket events as hints and refetches REST truth. REST is truth, socket is a hint (from spec 0007).
* Only kitchen and admin roles can mutate orders. Front desk can read the board only.
* Concurrent transitions to the same order return 409 to the second request; the board refetches to show the real state.

**Security model**:
* Authentication: all kitchen endpoints require a valid staff BetterAuth session via `requireStaffRole`.
* Authorization: mutation endpoints (verify, eta, ready, served, cancel) require `KITCHEN` or `ADMIN` role. The GET endpoint also allows `FRONT_DESK` for read only board viewing.
* Rate limiting: mutations use `kitchenStaffKey(userId)` at 20 per 15 min plus `kitchenIpKey(ip)` at 60 per 15 min, returning 429 with `Retry-After`. GET is not rate limited (read only, already auth gated).
* Actor tracking: `verifiedBy` and `cancelledBy` record which staff member acted, for accountability.
* No guest PII beyond room number reaches the board. Guest names are not displayed on order cards.
* Route gate: extend `proxy.ts` `/kitchen` to allow `FRONT_DESK` alongside `KITCHEN` and `ADMIN` (today only kitchen and admin pass).
* Page gate: `app/kitchen/page.tsx` today redirects front desk to `/stays`; render the board for desk with `readOnly` UI instead.
* Realtime: extend server `join.kitchen` to admit `FRONT_DESK` for passive subscribe; mutations stay kitchen and admin only on REST.

**Configuration required**:

No new environment variables. Reuses `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` from existing config. The audio chime is a bundled static asset, not a configured value.

**Library permissions**:

Log for working agreement 1:
* No new outside packages. Web Audio API is built into browsers. The countdown timer uses `setInterval`. All other dependencies (socket.io client, lru cache, Prisma, BetterAuth) are already approved.

**Critical test scenarios**:
* Happy path: kitchen staff verifies a PENDING order with ETA 15, order moves to PREPARING with `verifiedAt` set and `verifiedBy` recording the staff user, `order.status.changed` emitted to both rooms, verifies **AC-3**, **AC-8**.
* Happy path: kitchen advances PREPARING to READY to SERVED, each transition emits the event and sets timestamps, verifies **AC-5**, **AC-6**.
* Happy path: board loads with PENDING column oldest first and PREPARING column soonest ETA first, verifies **AC-1**, **AC-2**.
* Failure case: two staff try to verify the same PENDING order, second receives 409 with current status, board refetches, verifies **AC-13**.
* Failure case: kitchen cancels a PREPARING order with reason "out of stock", `cancelReason` and `cancelledBy` set, event emitted, verifies **AC-7**.
* Failure case: attempt to cancel a SERVED order returns 409, verifies **AC-7**, **AC-13**.
* Failure case: verify with etaMinutes 0 or 121 returns 400, verifies **AC-3**.
* Auth case: front desk can GET orders but POST verify returns 403, verifies **AC-2**, **AC-14**.
* Auth case: unauthenticated request returns 401, verifies **AC-2**.
* Rate limit case: 21 mutations in 15 min from same staff returns 429 with Retry-After, verifies **AC-11**.
* Realtime case: order.created event triggers audio chime and toast on the board, verifies **AC-9**.
* Reconnect case: board refetches on websocket reconnect and shows "Reconnected" toast, verifies **AC-10**.
* ETA case: kitchen updates ETA on PREPARING order, countdown refreshes, event emitted, verifies **AC-4**.

## Build plan

Ordered as Tracer Bullet (thin vertical slice through all layers first, then thicken):

1. Database migration: add `cancelReason` (text nullable), `verifiedBy` (text nullable FK to User), `cancelledBy` (text nullable FK to User) columns to Order, widen `etaMinutes` CHECK constraint from `5..120` to `1..120`, satisfies **AC-3**, **AC-7**
2. Kitchen order repository and service with state machine validation: implement `findActiveOrders`, `findOrderForTransition`, `verifyOrder`, `updateEta`, `markReady`, `markServed`, `cancelOrder` with transition guards (PENDING to PREPARING, PREPARING to READY, READY to SERVED, PENDING/PREPARING to KITCHEN_CANCELLED), actor tracking, and `emitOrderStatusChanged` after each commit, with service unit tests, satisfies **AC-3**, **AC-4**, **AC-5**, **AC-6**, **AC-7**, **AC-13**
3. Kitchen API route handlers with auth gates and rate limiting: build GET plus five POST/PATCH endpoints under `/api/kitchen/orders/`, wire `requireStaffRole` for kitchen/admin on mutations and kitchen/admin/front desk on GET, add `kitchenStaffKey` and `kitchenIpKey` rate limit keys, with integration tests, satisfies **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-6**, **AC-7**, **AC-11**, **AC-14**
4. Kitchen board UI with columns, order cards, and real time updates: build the `/kitchen` page replacing the placeholder, allow front desk read only (proxy plus page gate), extend `join.kitchen` for desk subscribe, with PENDING and PREPARING columns, order cards showing room number and bilingual item names, realtime client joining `kitchen:board` room, event listener refetching on each hint, empty and error states, satisfies **AC-1**, **AC-2**, **AC-8**, **AC-10**, **AC-12**, **AC-14**
5. Verify modal, ETA input, cancel dialog, and action buttons: add verify with ETA input (1 to 120), update ETA, mark ready, mark served, and cancel with reason dialogs, wired to the API endpoints, with optimistic UI updates and 409 recovery, satisfies **AC-3**, **AC-4**, **AC-5**, **AC-6**, **AC-7**, **AC-13**
6. Countdown timer and audio notification: implement per card `setInterval` countdown from `verifiedAt + etaMinutes` with urgency colors at 5 min and overdue, add audio chime on `order.created` event using Web Audio API with user interaction unlock, add toast notifications for new orders and reconnect, satisfies **AC-8**, **AC-9**, **AC-10**, **AC-12**

## Consequences

**Positive**:
* Kitchen gets full order lifecycle control in one live screen, reducing response time from order placement to preparation start.
* Actor tracking (`verifiedBy`, `cancelledBy`) creates accountability without the operational cost of a full audit table.
* Reusing the existing realtime layer (spec 0007) means no new infrastructure: the `emitOrderStatusChanged` helper, socket rooms, and client reconnect pattern are already tested and running.
* Front desk read only access reduces "where is my order" calls from guests by letting front desk check directly.

**Negative / tradeoffs**:
* The live countdown is computed client side, so a browser tab asleep or a device with a drifted clock shows slightly wrong time; REST refetch on focus corrects it.
* Single instance socket limitation (from spec 0007) still applies; a second server instance would split rooms and events.
* Audio chime requires one user interaction before it can play (browser autoplay policy); a kitchen that opens the board and walks away before touching the screen will miss the first chime.
* Three new nullable columns on Order are inexpensive but do widen the row; acceptable for V1.

**Neutral**:
* Guest live order status (Feature 11) and folio line creation (Feature 9) build on the same `order.status.changed` events this feature emits; no extra plumbing needed.
* The `etaMinutes` CHECK constraint widening (5 to 1 minimum) is backward compatible; existing orders with `etaMinutes >= 5` still satisfy the new constraint.

## Follow-up

* [ ] Connect guest live order status (Feature 11) to the `order.status.changed` events this feature emits.
* [ ] Wire folio line generation to the verify transition (PENDING to PREPARING) in Feature 9.
* [ ] Consider adding an `OrderStatusHistory` audit table if operational needs require full transition history beyond `verifiedBy` and `cancelledBy`.
* [ ] Add a chime volume/mute toggle to the board if kitchen staff request it.
* [ ] Reconcile spec 0007 verify manual step "desk sign in gets FORBIDDEN" on kitchen join after front desk read only subscribe ships here.

