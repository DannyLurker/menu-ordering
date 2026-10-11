# Verify: Guest order with PIN verify · spec 0009 · updated 2026-10-11

_Steps derived from spec 0009 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

* [ ] Open `/guest/menu` with active stay session cookie → category tabs, available items, and room info display in English and Indonesian → AC-1
* [ ] Add items to cart with quantities between 1 and 20 → floating cart summary bar appears with item count and whole rupiah total → AC-1
* [ ] Open cart drawer → items, unit prices, quantity steppers, and total display accurately → AC-1
* [ ] Click Proceed with PIN → PIN verification dialog opens with masked 6 digit input → AC-2
* [ ] Enter wrong PIN → error displays remaining attempts count without placing order → AC-5
* [ ] Submit 5 incorrect PINs → stay locks, sessions revoke, and front desk contact alert displays → AC-5, AC-6
* [ ] Enter correct PIN → order created with PENDING status, confirmation dialog displays summary, and cart clears → AC-2, AC-3, AC-4
* [ ] Click Orders header button → order history drawer lists placed orders with computed total amount → AC-10
* [ ] Submit order within 10 seconds of another identical order → duplicate order rejection notice displays → AC-7

_Note: UI steps not exercised. No browser connected to this session. API endpoints verified directly with session cookie instead._

## Commands

* [x] `cmd /c pnpm tsx scripts/prove-guest-order.ts` → all 30+ database assertions pass including order creation, wrong PIN tracking, lockout, price snapshotting, and duplicate guards → AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-9, AC-10
* [x] `cmd /c pnpm test features/orders/ --run` → 17 unit tests pass covering validation schemas, whole rupiah calculations, and service orchestration → AC-1, AC-3, AC-5, AC-9, AC-10
* [x] `cmd /c pnpm test app/api/orders/route.test.ts --run` → 7 integration tests pass covering cookie auth, validation, rate limiting, and order history → AC-4, AC-7, AC-8, AC-10, AC-11
* [x] `cmd /c pnpm build` → Next.js production build and TypeScript checks pass with zero errors across all 22 routes → AC-11

## Live API verification (with session cookie)

* [x] GET /api/orders with valid session → 200, empty orders array → AC-10
* [x] POST /api/orders with wrong PIN → 401 WRONG_PIN with remainingAttempts → AC-5
* [x] POST /api/orders with correct PIN → 201, orderId, PENDING status, totalAmount, items → AC-2, AC-3, AC-4
* [x] GET /api/orders after placing order → 200, order list with computed total → AC-10
* [x] GET /guest/menu with session → 200, HTML renders menu items, prices in whole rupiah → AC-1
* [x] GET /api/orders without cookie → 401 Unauthorized → AC-1, AC-2

## Value sourcing coverage

* [x] Order total → computed from unitPrice multiplied by quantity across line items in whole rupiah
* [x] Unit price snapshot → read from MenuItem.price in database at time of order creation
* [x] PIN verification → checked via verifyPin with support for scrypt to bcrypt lazy upgrade
* [x] Stay orderability → verified via isStayOrderable helper checking status ACTIVE and UTC dates
* [x] Lock trigger → stay failedPinAttempts incremented atomically, locking on fifth miss
* [x] Deduplication → in memory 10 second cache key registered upon successful order creation
* [x] Gateway exemption → proxy.ts allows guest order endpoints without staff credentials

## Acceptance criteria coverage

* AC-1: covered by API browse check, menu HTML render, and unit tests
* AC-2: covered by PIN verify service logic, API order placement, and integration tests
* AC-3: covered by atomic transaction order placement and price comparison in prove script
* AC-4: covered by success payload, reset counter in prove script and API
* AC-5: covered by wrong PIN warning, lockout on 5th strike in prove script and API
* AC-6: covered by isStayOrderable check and locked stay rejection in prove script
* AC-7: covered by 10 second deduplication cache in prove script and integration tests
* AC-8: covered by order rate limit constants and 429 response handling in integration tests
* AC-9: covered by item availability check and 400 error response in prove script
* AC-10: covered by GET /api/orders API and prove script
* AC-11: covered by proxy.ts route exemption and build check
