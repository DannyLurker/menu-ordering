# 0002. Data model: rationale

## Context

The app must support the full order loop from check in to served plus the room bill without a later rewrite. Guests order from the room, kitchen verifies each order and sets a time estimate, the bill collects verified orders, and payment rows record the guest choice in V1.1. The scope row for this feature names the pieces: guests, stays with dates, secret 6 digit PIN (a short code the guest sets), menu, orders with the full status set, folio plus folio lines, payment rows, ETA minutes (estimated prep minutes).

The stack is already fixed in spec 0001: Next.js with TypeScript, Prisma 7 with PostgreSQL (a relational store, meaning tables with links and rules), BetterAuth for staff identity, socket rooms for live flow. The schema file held only the provider plus generator before this decision, so this spec is the first real model. Tracer Bullet is the build approach (prove one thin real loop first, then thicken it), which shapes the build plan into a thin core migration first.

## Options considered

### Option 1: Full relational model now

One coherent Prisma model with Stay, Guest, MenuCategory, MenuItem, Order, OrderItem, Folio, FolioLine, Payment, reusing BetterAuth staff tables, built in one target with a thin core migration first.

**Pros**:

- Later slices need no breaking change, folio plus payment are ready
- Relational links plus rules protect bill rows from day one

**Cons**:

- Slightly larger first migration than Slice 1 strictly needs

### Option 2: Slice 1 only model

Stays plus menu plus orders now, folio plus payment added in Slice 2 as a second design.

**Pros**:

- Smallest first migration

**Cons**:

- Slice 2 forces a model change mid build with rework risk on live order code

### Option 3: Loose document style with few links

Fewer foreign keys (links between tables), more app level checks, flexible fields.

**Pros**:

- Fast to change early

**Cons**:

- Bill rows lose store level protection, totals can drift, harder to query by stay

## Rationale

You chose full loop support in the design walk, so the model must hold folio plus payment from day one even though Slice 1 exercises only stays plus orders plus verify. Option 1 matches the scope done state (no breaking change later) and the relational stack from spec 0001, where joins plus constraints guard bill rows. Option 2 saves a little now and costs a migration plus code rework in Slice 2. Option 3 fits a document store, not this relational project, and weakens the money adjacent rows.

Cross check fixes applied at build time: scrypt PIN with 5 miss lock plus staff unlock, hotel local day for stay dates, ETA 5 to 120 required at verify, folio closes at checkout, cancel after verify keeps voided lines, unique orderId guard against double verify, totals exclude VOID, money in whole rupiah with plain price field names.
