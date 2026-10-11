# 0007. Realtime foundation and rate limiting: rationale

## Context

The app must feel live in two places at once. Kitchen needs a new order the moment a guest places it. Guests need status plus ETA the moment kitchen verifies or advances it. Today the socket layer is a demo chat in `server.ts` with a user to socket map plus direct messages, no rooms, no session checks, no order events. The limiter is further along: `lib/rate-limit.ts` already holds LRU budgets for sign in plus stay mint with durable lock columns behind them. Slice 1 (check in, guest order, kitchen board) cannot start cleanly until one room plan plus one limit pattern exist for all of them to share. Without this decision each slice would invent its own channel names, its own join checks, and its own caps, and cross stay leaks plus inconsistent 429s would follow.

Forces shaping the call: one hotel on one server in V1.1 so local memory is honest; hotel wifi drops so reconnect must heal; stay privacy is load bearing so rooms must scope by verified session; brute force on PIN plus spam on order create are the two abuse paths worth blunting now; team runs a Next monolith with a custom socket entrypoint so same origin plus one shared server is the grain to follow.

## Options considered

### Option 1: Stay plus kitchen rooms with server emit plus extended LRU budgets

One room per stay plus one fixed kitchen room. Join checks read cookies and derive room names server side. Only the server emits `order.created` plus `order.status.changed` after REST writes. LRU keeps its helper shape and gains order create keys. REST stays truth; socket stays a hint with rejoin plus refetch.

**Pros**:

- Smallest change that proves the full loop on real structure.
- Privacy by construction: no client id ever picks a room.
- No new infra and no new packages.

**Cons**:

- Single instance only; rooms plus counters are local.
- Membership trusts join time checks until leave or disconnect.

### Option 2: Per order rooms with replay log

One room per order inside the stay scope plus a recent event log per room for replay on rejoin.

**Pros**:

- Tightest fanout and self healing gaps with no refetch.

**Cons**:

- Many rooms plus a new store to own, purge, and secure.
- Replay can re emit stale states unless ids plus ordering are done well.

### Option 3: Shared pub sub plus durable limiter now

Add a shared pub sub for rooms plus a Postgres backed limiter so two hosts work from day one.

**Pros**:

- Horizontal scale from the start with shared truth.

**Cons**:

- New infra for a scale event with no date; extra latency plus ops for one hotel.
- Over built for V1.1 traffic.

### Option 4: Client emitted events with open rooms

Clients emit order state directly into a global room and filter locally.

**Pros**:

- Least server code.

**Cons**:

- Spoofable state plus cross stay leak; every client sees every order.
- No throttle point worth trusting.

## Rationale

Option 1 wins because it matches the forces with the least new machinery. The stack already approves socket rooms plus LRU limits, and the auth spec already supplies the sessions the join checks need, so the foundation only wires proven parts together. Per order rooms plus replay (Option 2) add a store before a measured gap exists. Shared infra now (Option 3) pays for scale with no date. Open rooms (Option 4) trade the one property this feature must guarantee, stay privacy, for less code.

RECOMMEND calls made at write time: structured console logs only with ids plus role (runner up a counters endpoint, deferred as extra surface); no new env vars with same origin only (runner up explicit CORS list, unneeded on one shared server); order create at 20 per stay plus 60 per IP per 15 min (runner up 30 plus 100, looser but softer against spam); no new screens in this foundation with later slices owning loading plus empty plus error (runner up a shared hook now, deferred to first consumer). External integrations: none; `socket.io` plus `lru-cache` already approved and already installed per working agreement 5, reuse beats hand roll. SEO and discoverability: not applicable, all surfaces sit behind stay or staff gates.
