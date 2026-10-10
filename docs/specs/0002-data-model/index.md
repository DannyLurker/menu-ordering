# 0002. Data model

**Date**: 2026-10-10
**Status**: In Progress

## Summary

This spec defines the core tables for the hotel menu ordering app (the system guests use to order food from the room and kitchen uses to track each order). You get nine tables that cover stays, menu, orders, folio (the room bill) and payments with no breaking change later. Slice 1 builds on this directly with one migration plus small thickening steps.

## Requirements

**User stories**:

- As a front desk staff member, I want to check a guest in with room plus dates plus PIN so the guest can order during the stay only.
- As a guest, I want to order menu items with my PIN so only my stay is charged.
- As a kitchen staff member, I want to verify each order with prep minutes so the guest sees live progress.
- As an admin, I want every verified order on the room folio so checkout totals are correct.

**Acceptance criteria**:

- **AC-1**: A checked in stay with valid dates can place an order, and an expired or checked out stay cannot.
- **AC-2**: Guest identity resolves to exactly one stay, and the 6 digit PIN verifies against that stay only.
- **AC-3**: Menu has categories plus items with price in whole rupiah (IDR) plus availability, and hidden items cannot be ordered.
- **AC-4**: Folio plus folio lines are created at kitchen verify, and unpaid orders stay on the room folio.
- **AC-5**: PIN is stored hashed (scrambled one way, never readable) with failed attempt count plus lock flag, never plain text.
- **AC-6**: Orders use the full status set PENDING, PREPARING, READY, SERVED, GUEST_CANCELLED, KITCHEN_CANCELLED with valid transitions only.
- **AC-7**: Verified orders carry nullable prep minutes set by kitchen and readable live by the guest.
- **AC-8**: A yes to pay now in V1.1 creates a payment row linked to order plus folio as record only with no money movement.
- **AC-9**: Order plus folio rows are kept for history with no auto delete, and totals match between guest view and staff view.

## Decision

**Chosen option**: Option 1: Full relational model now

You build the full relational target below in Prisma 7 with PostgreSQL, thin core tables first then folio plus payment thickening, reusing BetterAuth tables for staff.

**Implementation skills**: `prisma-client-api` (`prisma/skills`, `.agents/skills/prisma-client-api/`) · `prisma-orm-setup` (`prisma/skills`, `.agents/skills/prisma-orm-setup/`)

## Rationale

Reasoning and options: see rationale.md.

## Feature design

**Data model sketch**:

| Entity       | Key fields                                                                                                                                                                                                                                                    | Links                                                           | Rules                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Stay         | id (uuid, req), roomNumber (text, req), guestName (text, req), checkIn (date, req), checkOut (date, req), status (enum ACTIVE CHECKED_OUT CANCELLED, req), pinHash (text, req, scrypt), failedPinAttempts (int, req, default 0), pinLocked (bool, req, default false), pinSetAt (opt) | 1 to N Order, 1 to 1 Folio, 1 to N Guest                        | One ACTIVE stay per roomNumber (partial unique index), checkOut after checkIn, dates read on hotel local day, PIN set by guest at check in, 5 misses locks, only staff unlocks, LRU counters are speed path and Postgres stays truth                             |
| Guest        | id (uuid, req), fullName (text, req), stayId (fk, req), createdAt (req)                                                                                                                                                                                       | N to 1 Stay                                                     | Extra companion rows per stay created at check in, stay is the identity anchor, Stay guestName is the primary name shown                                                  |
| MenuCategory | id (uuid, req), nameEn (text, req), nameId (text, req), sortOrder (int, req), isActive (bool, req)                                                                                                                                                            | 1 to N MenuItem                                                 | Names in both languages per localization scope                                                            |
| MenuItem     | id (uuid, req), categoryId (fk, req), nameEn (req), nameId (req), price (int, req), isAvailable (bool, req), sortOrder (int, req)                                                                                                                        | N to 1 MenuCategory, 1 to N OrderItem                           | price nonnegative in whole rupiah (IDR, no cents), unavailable items rejected at order time, qty 1 to 20 per line, empty orders rejected, duplicate lines merge by menuItemId                                          |
| Order        | id (uuid, req), stayId (fk, req), status (enum, req, default PENDING), etaMinutes (int, opt, 5 to 120, required at verify, editable until READY), placedAt (req), verifiedAt (opt), servedAt (opt)                                                                                                                | N to 1 Stay, 1 to N OrderItem, 1 to N FolioLine, 1 to N Payment | Status set PENDING PREPARING READY SERVED GUEST_CANCELLED KITCHEN_CANCELLED                               |
| OrderItem    | id (uuid, req), orderId (fk, req), menuItemId (fk, req), qty (int, req), unitPrice (int, req, snapshot)                                                                                                                                                  | N to 1 Order, N to 1 MenuItem                                   | qty positive, unitPrice copied from MenuItem at order time so later price edits keep history correct |
| Folio        | id (uuid, req), stayId (fk, unique, req), status (enum OPEN CLOSED, req), createdAt (req), closedAt (opt, set at checkout)                                                                                                                                                     | 1 to 1 Stay, 1 to N FolioLine, 1 to N Payment                   | One folio per stay                                                                                        |
| FolioLine    | id (uuid, req), folioId (fk, req), orderId (fk, req), orderItemId (fk, opt), labelEn (req), labelId (req), amount (int, req)                                                                                                                             | N to 1 Folio, N to 1 Order                                      | Created at kitchen verify, amount from snapshot price times qty, orderId unique so double verify cannot duplicate lines, labels from menu snapshot in both languages, cancel after verify keeps lines and voids them                                           |
| Payment      | id (uuid, req), orderId (fk, req), folioId (fk, req), method (enum ROOM_CHARGE EWALLET_RECORD, req), status (enum RECORDED VOID, req), amount (int, req), recordedAt (req)                                                                               | N to 1 Order, N to 1 Folio                                      | V1.1 record only, amount equals folio share for the order, no partial payments, VOID keeps history, Xendit fields land in V1.2                                           |

Staff identity reuses BetterAuth tables (user, session, account, verification) per spec 0001, no new staff tables here. LRU cache holds PIN retry counters in memory for speed, Postgres columns above stay authoritative per spec 0001.

**State transitions**:

Order: PENDING to PREPARING (kitchen verify with etaMinutes) to READY to SERVED. PENDING to GUEST_CANCELLED only before verify, PREPARING to KITCHEN_CANCELLED only before READY, cancel after verify keeps folio lines as voided. Terminal states SERVED, GUEST_CANCELLED, KITCHEN_CANCELLED accept no further moves.

Stay: ACTIVE to CHECKED_OUT to closed folio. CANCELLED ends ordering at once.

**How the feature works**:

1. Front desk creates Stay with room plus dates plus guest name, guest sets 6 digit PIN stored as pinHash.
2. Guest picks available MenuItems, system creates Order in PENDING with OrderItems carrying snapshot prices, stay dates validated.
3. Guest enters PIN, system hashes and compares to pinHash, wrong PIN raises failedPinAttempts and asks again, limit trips pinLocked with call staff message.
4. Kitchen verifies PENDING to PREPARING with etaMinutes, system creates Folio (if missing) plus FolioLines from OrderItems.
5. Kitchen advances to READY then SERVED, guest reads status plus etaMinutes live.
6. Guest answers pay now, yes creates Payment as EWALLET_RECORD, no keeps ROOM_CHARGE on folio.

**API surface**:

No new HTTP routes in this spec. Later specs own routes. Logical operations this model must support:

| Operation      | Key inputs                               | Key outputs                      | Auth         | Key errors                     |
| -------------- | ---------------------------------------- | -------------------------------- | ------------ | ------------------------------ |
| Create stay    | roomNumber, guestName, checkIn, checkOut | stay id                          | staff role   | room already has ACTIVE stay   |
| Set PIN        | stayId, pin 6 digits                     | ok                               | stay session | weak format, stay not ACTIVE   |
| Place order    | stayId, items plus qty, pin              | order id PENDING                 | stay session | stay expired, item unavailable |
| Verify order   | orderId, etaMinutes                      | order PREPARING plus folio lines | kitchen role | order not PENDING              |
| Record payment | orderId, method                          | payment RECORDED                 | stay session | order not verified             |

**Value sourcing**:

| Action            | Value produced or displayed | Source                                                                               |
| ----------------- | --------------------------- | ------------------------------------------------------------------------------------ |
| Place order       | order total                 | derived from OrderItem unitPrice times qty                                      |
| Place order       | stay validity               | Stay checkIn plus checkOut plus status columns                                       |
| Verify order      | folio line amounts          | OrderItem snapshot columns                                                           |
| Guest status view | etaMinutes                  | Order etaMinutes column, set by kitchen input                                        |
| Folio view        | folio balance               | derived from FolioLine amount sum minus Payment RECORDED sum (VOID excluded), whole rupiah only |
| PIN check         | match result                | input pin hashed compared to Stay pinHash column                                     |
| Lockout message   | locked state                | Stay pinLocked plus failedPinAttempts columns, LRU counters as speed path            |

**Key invariants**:

- One ACTIVE stay per roomNumber enforced by partial unique index.
- One folio per stay enforced by unique stayId on Folio.
- Order total equals sum of its OrderItem snapshot lines, computed at read time except folio snapshot.
- Unavailable menu items cannot appear on new orders, enforced at order creation.
- Expired or checked out stays cannot create orders.
- PIN never stored or logged in plain text.
- FolioLines exist only for verified orders.
- Payments reference both order and folio so totals reconcile.

**Security model**:

Staff reads and writes by role (front desk creates stays, kitchen verifies, admin manages menu), guest reads and writes only own stay rows resolved by stay session plus PIN. PIN hash plus session tokens never logged. No compliance scope beyond normal guest names plus stay dates, no card data in V1.1.

**Configuration required**:

No new env vars. Uses `DATABASE_URL` from spec 0001.

**Critical test scenarios**:

- Happy path: check in to order to verify to folio lines to served, verifies **AC-1, AC-4, AC-6**.
- Failure case: wrong PIN five times asks again then locks with call staff message, verifies **AC-2, AC-5**.
- Failure case: order unavailable item or expired stay rejected, verifies **AC-1, AC-3**.
- Auth case: guest cannot read another stay folio, kitchen only verifies, verifies **AC-2**.
- Record case: pay now yes creates payment row, no keeps room charge, totals match both views, verifies **AC-8, AC-9**.

## Build plan

Ordered by Tracer Bullet (thin real loop first, then thicken). Migration is the target sized to this feature in two steps so the thin loop runs early.

1. Create core migration with Stay, Guest, MenuCategory, MenuItem, Order, OrderItem plus enums plus indexes, satisfies **AC-1, AC-2, AC-3, AC-5, AC-6, AC-7**.
2. Extend migration with Folio, FolioLine, Payment plus one folio per stay rule plus folio creation at verify logic, satisfies **AC-4, AC-8, AC-9**.
3. Add seed with two categories plus five items plus one demo ACTIVE stay for local verify, satisfies **AC-3**.
4. Prove with Prisma validate plus generate plus migrate plus a script that runs the how it works steps 1 to 6 on a throwaway store, satisfies **AC-1 to AC-9**.

## Planned feature workflow

Plan, build with `/develop`, prove with `/check verify` (migration applies clean, scripted loop passes, build passes), cover with `/test`, review with a fresh model `/check review`, note with `/document`. Spec status moves Proposed to In Progress to Accepted as the scope row moves. `/develop` updates this plan to match what was actually built.

## Consequences

**Positive**:

- Full loop plus bill ready with no later breaking change
- Store level rules guard bill rows from day one
- Snapshot prices keep history correct when menu prices change
- PIN hashing plus lockout columns built in before Slice 1

**Negative / tradeoffs**:

- First migration larger than Slice 1 minimum, more review surface now
- Snapshot logic adds a little order creation code versus live price reads
- Keeping all history grows the store over time, later archive work owed

**Neutral**:

- BetterAuth staff tables reused untouched, guest identity stays on Stay
- LRU counters stay a speed path only, Postgres stays truth
- Xendit gateway fields deferred to V1.2, V1.1 payment stays record only

## Follow-up

- [ ] Auth and roles spec must define staff roles plus stay session join rules on top of this model
- [ ] Real time spec must define order event payloads using order id plus status plus etaMinutes from this model
- [ ] Later archive or retention policy when history volume grows
- [ ] Library permission log per working agreement 1: no new outside library in this spec, Prisma 7 already approved in spec 0001
