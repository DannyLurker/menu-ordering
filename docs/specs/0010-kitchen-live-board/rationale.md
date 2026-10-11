# 0010. Kitchen live board with verify and ETA: Rationale

## Context

The hotel menu ordering system has a working guest order flow (spec 0009): guests browse the menu, place orders with PIN verification, and orders are created with status PENDING. The realtime foundation (spec 0007) already emits `order.created` events to a `kitchen:board` socket room and provides the client reconnect and refetch pattern. What is missing is the kitchen side: the screen and the API that let kitchen staff see, verify, and advance orders through the lifecycle.

Without this feature, orders would sit in PENDING forever with no way to prepare them. The kitchen board is the second half of the core order loop (the "walking skeleton" in Slice 1): guest places, kitchen processes.

The key forces:
* Real time visibility is essential; kitchen staff should not poll or refresh the page.
* The status lifecycle (PENDING to PREPARING to READY to SERVED, with cancellation) is already defined in the data model (spec 0002) and needs exact implementation.
* ETA is a guest facing promise; it must be set at verify time and updatable if circumstances change.
* Accountability matters: the hotel wants to know which staff member verified or cancelled an order.
* The existing realtime layer (spec 0007) provides all the plumbing; this feature only needs REST endpoints that call the existing `emitOrderStatusChanged` helper.

## Options considered

### Option 1: REST mutations with server side socket emit plus column board (chosen)

Each status transition is a separate REST endpoint (`/verify`, `/ready`, `/served`, `/cancel`, `/eta`). After each successful database write, the server calls the existing `emitOrderStatusChanged` helper to fan the event to the stay room and kitchen room. The board is a client component that joins `kitchen:board`, listens for events as hints, and refetches REST truth on each event. Countdown timers run locally with `setInterval`.

**Pros**:
* Reuses the existing realtime emit helper with no new socket event types; just REST endpoints plus emit calls.
* Separate endpoints per transition make authorization and validation simple and explicit.
* Client side countdown avoids server timer complexity.
* REST as truth plus socket as hint is already the project pattern (spec 0007).

**Cons**:
* Six endpoints is more route files than a single PATCH; though each is small and focused.
* Client side countdown can drift on sleeping tabs; focus refetch corrects this.

### Option 2: Single PATCH endpoint with action field

One `PATCH /api/kitchen/orders/[id]` endpoint receives an `action` field (verify, ready, served, cancel) plus action specific fields (`etaMinutes`, `reason`). Fewer route files.

**Pros**:
* Fewer route files; one handler manages all transitions.

**Cons**:
* The single handler becomes a switch statement mixing validation logic for different transitions, harder to test and harder to gate at the rate limit level.
* Harder to add per transition authorization later (e.g. if only admin can cancel but any kitchen staff can verify).

### Option 3: Server side countdown with push

Server runs a timer per order and pushes countdown updates to the client every second.

**Pros**:
* Client clock drift is eliminated; server is the single source of time.

**Cons**:
* Massive socket traffic: one message per second per preparing order across all connected clients. A busy kitchen with 20 orders means 20 messages per second per client.
* Server timer management adds state and complexity (what happens on restart?).
* Overkill when the countdown is a cosmetic indicator and REST refetch corrects drift on focus.

## Rationale

Option 1 fits because the project already has the realtime layer (spec 0007) with the emit helper and the client reconnect and refetch pattern. Adding REST endpoints that call `emitOrderStatusChanged` after each write is the minimum new code. Separate endpoints match the existing pattern (spec 0009 uses dedicated POST/GET for orders) and make each transition independently testable, rate limitable, and authorizable. Option 2 saves route files but bundles unrelated logic. Option 3 solves a problem (clock drift) that does not meaningfully affect kitchen operations and adds disproportionate server load. The client countdown with focus refetch is good enough for a kitchen display where staff are actively watching the screen.

