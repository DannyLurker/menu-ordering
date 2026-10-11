# 0009. Guest order with PIN verify

**Date**: 2026-10-11
**Status**: In Progress

## Summary

Checked in guests browse the hotel menu, add items to a cart, and place an order using their 6 digit personal code (PIN) to confirm. The system checks stay validity, verifies the code against the stored hash, increments a failure counter on mistakes, and locks the stay if 5 wrong attempts occur. Successful orders are created with status PENDING and saved with item price snapshots in one database transaction.

## Requirements

**User stories**:

- As a checked in guest, I want to browse available menu items and add them to my cart so that I can order food and drinks to my room.
- As a checked in guest, I want to confirm my order with my 6 digit PIN so that only authorized occupants in my room can place orders.
- As a hotel, I want orders blocked when a stay is inactive, expired, or PIN locked so that unauthorized charges are prevented.
- As a hotel, I want repeated wrong PIN entries during ordering to lock the stay with a contact front desk message so that brute force attempts are stopped.
- As a checked in guest, I want to view my placed active orders so that I know my order is pending kitchen preparation.

**Acceptance criteria**:

- **AC-1**: Guest with a valid stay session cookie can view available menu categories and items at `/guest/menu` in English and Indonesian, and add items with quantities between 1 and 20 to a cart drawer.
- **AC-2**: Submitting the cart presents a PIN verification modal requiring a 6 digit PIN. `POST /api/orders` verifies the PIN against the stay PIN hash using `verifyPin` from `lib/pin.ts`, supporting lazy migration from scrypt to bcrypt.
- **AC-3**: On correct PIN, system validates all items exist and are available, calculates item subtotals using current DB prices, compares submitted required `clientTotal` against DB total (rejecting with 409 `PRICE_MISMATCH` on difference), and writes `Order` (status `PENDING`, `placedAt` now) and `OrderItem` rows in one atomic database transaction.
- **AC-4**: On success, `POST /api/orders` resets `failedPinAttempts` to zero while keeping endpoint rate limit counters intact, registers the order deduplication key, and returns `orderId`, status `PENDING`, `placedAt`, `totalAmount`, and items list.
- **AC-5**: On incorrect PIN, system atomically increments `failedPinAttempts`. If attempts reach `PIN_LOCK_THRESHOLD` (5), system sets `pinLocked = true`, revokes all active stay sessions (`revokeSessionsForStay`), and returns 401 with code `STAY_LOCKED` and a bilingual contact front desk message. If under 5, returns 401 with code `WRONG_PIN`, `remainingAttempts` count, and a prompt to re-enter.
- **AC-6**: Order submission validates stay orderability via `isStayOrderable`. If stay is not ACTIVE or today UTC falls outside checkIn to checkOut, request returns 403 `STAY_NOT_ACTIVE` with bilingual contact front desk message. If stay is already PIN locked, returns 403 `STAY_LOCKED`.
- **AC-7**: Duplicate order protection: identical submissions with the same cart items within 10 seconds for the same stay return 409 `DUPLICATE_ORDER` asking the guest to wait. The deduplication key is registered only upon successful order placement so mistyped PIN entries never block immediate retry.
- **AC-8**: Endpoint throttling: `POST /api/orders` enforces rate limits using existing constants in `lib/rate-limit.ts` (20 attempts per stay and 60 per IP per 15 minutes) returning 429 Too Many Requests and `Retry-After` header.
- **AC-9**: Unavailable items: if any menu item in the cart is unavailable (`isAvailable = false`), submission is rejected with 400 Bad Request, code `ITEM_UNAVAILABLE`, bilingual message, and `details` listing the unavailable items.
- **AC-10**: Order query surface: `GET /api/orders` returns orders for the authenticated stay session ordered by `placedAt` descending, including in memory computed `totalAmount`, status, and items list.
- **AC-11**: Gateway routing: `proxy.ts` allows guest access to `/guest/menu` and `/api/orders` without requiring a staff BetterAuth session.

## Decision

**Chosen option**: Option 1: Combined cookie session plus PIN verification with in memory throttle and atomic order persistence

Guests authenticate with their active stay cookie, confirm each order submission with their 6 digit room PIN, and the server processes order creation atomically in PostgreSQL while sharing the stay lock counter.

## Rationale

Reasoning and options: see rationale.md.

## Feature design

**Data model sketch**:

- Stay (existing, defined in spec 0002 and spec 0008): id uuid pk, roomNumber text, guestName text, checkIn Date, checkOut Date, status StayStatus default ACTIVE, pinHash text, failedPinAttempts int default 0, pinLocked boolean default false, pinSetAt timestamptz nullable.
- Order (existing, defined in spec 0002): id uuid pk, stayId uuid fk to Stay restrict, status OrderStatus default PENDING, etaMinutes int nullable, placedAt timestamptz default now, verifiedAt timestamptz nullable, servedAt timestamptz nullable.
- OrderItem (existing, defined in spec 0002): id uuid pk, orderId uuid fk to Order cascade, menuItemId uuid fk to MenuItem restrict, qty int (1 to 20 per database CHECK constraint), unitPrice int (snapshot of price at order time in whole rupiah).
- MenuItem (existing, defined in spec 0002): id uuid pk, categoryId uuid fk to MenuCategory restrict, nameEn text, nameId text, price int, isAvailable boolean default true, sortOrder int default 0.
- MenuCategory (existing, defined in spec 0002): id uuid pk, nameEn text, nameId text, sortOrder int default 0, isActive boolean default true.

**State transitions**:
Order lifecycle starts in this feature:

- PENDING: order placed by guest with correct PIN, awaiting kitchen verification.
  Transitions to PREPARING, READY, SERVED, GUEST_CANCELLED, and KITCHEN_CANCELLED belong to subsequent kitchen and status slices.

Stay PIN state transitions during ordering:

- Clean (failedPinAttempts = 0, pinLocked = false).
- Warning (failedPinAttempts 1 to 4, pinLocked = false).
- Locked (failedPinAttempts >= 5, pinLocked = true, all sessions revoked, front desk intervention required).

**API surface**:
| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| /api/orders | POST | pin: string 6 digits req, items: array of { menuItemId: string, qty: number } req, clientTotal: number req | orderId, status, placedAt, totalAmount, items | stay_session cookie required | 400 ITEM_UNAVAILABLE with details or invalid input, 401 WRONG_PIN with remainingAttempts, 401 STAY_LOCKED, 403 STAY_NOT_ACTIVE or STAY_LOCKED, 409 DUPLICATE_ORDER or PRICE_MISMATCH, 429 RATE_LIMITED |
| /api/orders | GET | none | orders: array of { id, status, placedAt, totalAmount, items: array of { id, menuItemId, nameEn, nameId, qty, unitPrice } } | stay_session cookie required | 401 unauthenticated, 403 STAY_NOT_ACTIVE |

**Value sourcing**:
| Action | Value produced or displayed | Source |
|---|---|---|
| Place order | stayId | Session resolution from stay_session cookie via resolveStaySession |
| Place order | orderId | DB column Order.id generated uuid |
| Place order | status | DB default value OrderStatus.PENDING |
| Place order | placedAt | DB default now or application timestamp |
| Place order | unitPrice | DB column MenuItem.price snapshot taken during transaction |
| Place order | totalAmount | Computed sum of qty \* unitPrice for all order items in whole rupiah |
| Place order | PIN match | Comparison of submitted pin against Stay.pinHash using verifyPin with lazy upgrade |
| Place order | Lock trigger | Stay.failedPinAttempts atomic increment reaching 5 |
| Place order | Orderable check | Helper isStayOrderable evaluating Stay.status, Stay.checkIn, Stay.checkOut, today UTC |
| Place order | Duplicate rejection | In memory cache key stayId plus cartHash checking 10 second submission window |
| Menu browse | Category list | DB query MenuCategory where isActive true ordered by sortOrder |
| Menu browse | Item list | DB query MenuItem where isAvailable true ordered by sortOrder |
| View orders | Order list | DB query Order where stayId matches session ordered by placedAt desc |

**Key invariants**:

- An order cannot be placed without a valid stay session cookie and a matching 6 digit PIN.
- A stay outside its valid check in to check out dates or not in ACTIVE status cannot place orders.
- Failed PIN attempts during ordering count toward the same stay lockout counter as check in minting (5 strikes maximum).
- Reaching 5 failed PIN attempts locks the stay immediately and revokes all active stay sessions.
- Order item prices are snapshotted from the database at order placement time and never change if menu item prices change later.
- Order creation and line item inserts occur within a single database transaction; failure on any line rolls back the entire order.
- Duplicate submissions of the same cart items within 10 seconds for the same stay are rejected with 409 Conflict.
- All money values are non negative integers representing whole Indonesian Rupiah (no decimal cents).

**Security model**:

- Authentication: guest requests require the `stay_session` HTTP only cookie. Order creation additionally requires the room PIN in the request body.
- Authorization: guests can only place orders for their own authenticated stay and can only view orders associated with their own stayId.
- Rate limiting: order creation is rate limited using existing constants (20 per stay and 60 per IP per 15 minutes) using an LRU cache, returning 429 with Retry-After header.
- Brute force defense: 5 incorrect PIN entries set `pinLocked = true` and revoke all sessions for the stay. Only front desk staff can unlock the stay via `/api/stays/[id]/unlock`.
- Secrets and PII: PIN values are never logged, never stored plain, and never returned in responses. Server logs record only stayId, orderId, item count, and error codes.

**Planned workflow** (per working agreement 2):

1. Guest visits `/guest/menu` and views active menu categories and available items.
2. Guest adds items to cart with desired quantities (1 to 20 per item).
3. Guest opens the cart drawer and clicks checkout.
4. Guest enters the 6 digit room PIN in the verification modal and submits with client total.
5. System checks stay session, verifies stay dates, checks rate limits, and verifies PIN hash.
6. System checks item availability, calculates price snapshots, verifies total, and writes Order plus OrderItem rows.
7. System resets failed PIN attempts, registers deduplication key, and returns order summary with PENDING status.
8. Guest screen shows success confirmation and adds the order to active order tracking.

**Actual workflow** (what was built, matches the plan):

1. Guest visits `/guest/menu` and views active categories with available items in whole rupiah.
2. Guest adds items (1 to 20 per item), viewable in the responsive cart drawer.
3. Guest clicks checkout and enters the 6 digit room PIN in `PinCheckoutModal`.
4. Client sends required `pin`, `items`, and `clientTotal` to `POST /api/orders` with `stay_session` cookie.
5. System verifies stay is ACTIVE and covers today via `isStayOrderable`.
6. System checks PIN with `verifyPin` (supporting lazy scrypt upgrade), atomically updating failure count on mismatch.
7. 5th wrong attempt locks stay, revokes sessions, and returns 401 STAY_LOCKED.
8. On match, system validates prices and availability, compares clientTotal, creates Order and OrderItems in one transaction.
9. System registers 10s deduplication key, emits `order.created` event, resets failedPinAttempts, and returns order summary.
10. Success modal shows order details and adds order to live history list.

**How it works** (per working agreement 4):

1. Guest selects menu items and quantities in the browser.
2. Guest enters 6 digit PIN and clicks confirm order.
3. System reads stay session cookie and finds the corresponding stay in database.
4. System verifies stay is ACTIVE and dates cover today via `isStayOrderable`.
5. System checks stay is not locked and evaluates submitted PIN against `pinHash`.
6. On PIN mismatch, system atomically increments `failedPinAttempts`, locks stay if threshold 5 is reached, and returns error with remaining attempts.
7. On PIN match, system validates menu items, snapshots prices, verifies client total, creates Order and OrderItems in one transaction, and returns order details.

**Critical test scenarios**:

- Happy path: checked in guest adds available items, enters correct PIN, and receives order summary with PENDING status, verifies **AC-1**, **AC-2**, **AC-3**, **AC-4**.
- Failure case: guest enters incorrect PIN, receives 401 WRONG_PIN with remaining attempts count, and order is not created, verifies **AC-5**.
- Failure case: guest enters 5 consecutive incorrect PINs, stay becomes locked with sessions revoked and returns 401 STAY_LOCKED with front desk contact notice, verifies **AC-5**.
- Failure case: guest with expired stay or checked out status attempts to order and receives bilingual 403 STAY_NOT_ACTIVE notice, verifies **AC-6**.
- Failure case: rapid double submit within 10 seconds returns 409 DUPLICATE_ORDER, while wrong PIN retry is not blocked, verifies **AC-7**.
- Failure case: submitting an item marked unavailable in the database returns 400 ITEM_UNAVAILABLE with details, verifies **AC-9**.
- Failure case: price mismatch between clientTotal and database total returns 409 PRICE_MISMATCH, verifies **AC-3**.
- Auth case: unauthenticated request without cookie returns 401 Unauthorized, verifies **AC-1**, **AC-2**.
- Query case: guest fetches active orders and receives order list ordered by newest first with computed total amount, verifies **AC-10**.
- Gateway case: guest accesses `/guest/menu` and `/api/orders` through `proxy.ts` without staff redirection, verifies **AC-11**.

## Build plan

Ordered as Tracer Bullet (thin vertical slice through all layers first, then thicken):

- [x] 1. Pure calculation and validation helpers:
     Create Zod schemas for order submission, item validation, and pure calculation helpers verifying availability and whole rupiah totals with unit tests, satisfies **AC-1**, **AC-3**, **AC-9**
- [x] 2. Order repository and business service:
     Implement order repository queries and business service handling atomic order creation, PIN verification via `verifyPin`, atomic counter increment, stay lockout on 5 misses, counter reset on success, date validity via `isStayOrderable`, and order history queries with service tests, satisfies **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-6**, **AC-10**
- [x] 3. API route handlers, guard middleware, and proxy update:
     Build `POST /api/orders` and `GET /api/orders` with session resolution, 10 second deduplication, LRU rate limiting, bilingual error responses, and exempt `/guest/menu` plus `/api/orders` in `proxy.ts` with integration tests, satisfies **AC-4**, **AC-7**, **AC-8**, **AC-10**, **AC-11**
- [x] 4. Guest menu browsing and cart interface:
     Build `/guest/menu` page with category navigation, item cards, price display in whole rupiah, responsive cart drawer, quantity steppers (1 to 20), and bilingual English and Indonesian labels, satisfies **AC-1**, **AC-9**
- [x] 5. PIN checkout modal and order confirmation:
     Build PIN input modal with masked digits, submit loading state, wrong PIN error feedback with remaining attempts counter, lockout prompt, and order placed success screen, satisfies **AC-2**, **AC-4**, **AC-5**, **AC-6**

## Consequences

**Positive**:

- Guests can order directly from room devices with high confidence and privacy.
- Reusing the existing stay PIN counter prevents split brain brute force attacks across check in and ordering.
- Item prices are frozen at order time, protecting guests and hotel from price drift during fulfillment.
- No new database migrations or external dependencies are introduced.

**Negative / tradeoffs**:

- Requiring PIN entry on every order adds a small checkout step for guests, but prevents accidental room orders by visitors.
- In memory deduplication and rate limiting reside on a single instance, which fits the current architecture but requires Redis if multi host scaling occurs in the future.

**Neutral**:

- Folio and payment line generation is deferred to Slice 2 per project roadmap.
- Kitchen notification via websocket feeds into Feature 8 immediately following this slice.

## Follow-up

- [ ] Connect order placement events to the kitchen live board via websocket in Feature 8.
- [ ] Wire folio line generation to order verification in Slice 2 (Feature 9).
- [ ] Support guest dietary notes on order items if hotel operational needs arise.
