# Verify: Kitchen live board with verify and ETA · spec 0010 · updated 2026-10-11

_Steps derived from spec 0010 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

* [ ] Kitchen signs in, open `/kitchen` → PENDING and PREPARING columns render, empty state bilingual when no orders → AC-1, AC-12
* [ ] Guest places order (stay session) → within seconds kitchen board shows new card in PENDING without refresh, chime after one click on page, toast with room number → AC-9
* [ ] Verify PENDING order with ETA 15 → card moves to PREPARING, countdown visible, urgency color under 5 minutes → AC-3, AC-8
* [ ] PATCH ETA on PREPARING order → countdown updates after refetch → AC-4
* [ ] Mark Ready then Served → card leaves active columns, appears in completed strip when within window → AC-5, AC-6, AC-1
* [ ] Cancel PREPARING with reason → status KITCHEN_CANCELLED, reason stored, card leaves active columns → AC-7
* [ ] Front desk signs in, open `/kitchen` → board visible, no action buttons, GET works, POST verify returns 403 → AC-2, AC-14
* [ ] Disconnect network, reconnect → subtle Reconnected toast, list matches REST → AC-10
* [ ] Two browsers verify same PENDING order → second gets 409, board refetches to current state → AC-13

## Commands

* [ ] `pnpm test features/kitchen/` (or orders kitchen service path once added) `--run` → state machine, verify, cancel, ETA guards → AC-3, AC-4, AC-5, AC-6, AC-7, AC-13
* [ ] `pnpm test app/api/kitchen/` `--run` → auth, 409 transitions, rate limit 429 shape → AC-2, AC-11, AC-14
* [ ] `pnpm tsx scripts/prove-kitchen-board.ts` (once added) → end to end verify, ready, served, cancel, emit fanout → AC-1, AC-3, AC-5, AC-6, AC-7
* [ ] `pnpm build` → production build clean with kitchen routes → build integrity

## Live API verification (staff session cookie)

* [ ] GET `/api/kitchen/orders` as kitchen → 200, active orders with room numbers and items → AC-2
* [ ] POST `/api/kitchen/orders/{id}/verify` with etaMinutes 15 on PENDING → 200 PREPARING, verifiedAt set → AC-3
* [ ] POST verify on non PENDING → 409 with current status → AC-13
* [ ] PATCH `/api/kitchen/orders/{id}/eta` on PREPARING → 200, event emitted → AC-4
* [ ] POST ready / served in sequence → READY then SERVED, servedAt set → AC-5, AC-6
* [ ] POST cancel with reason on PREPARING → KITCHEN_CANCELLED → AC-7
* [ ] GET as front desk → 200; POST verify as front desk → 403 → AC-14
* [ ] 21 mutations in 15 min same staff → 429 with Retry-After → AC-11

## Value sourcing coverage

* [ ] verifiedAt and servedAt → application now at transition time
* [ ] verifiedBy and cancelledBy → staff user id from session, never client body
* [ ] etaMinutes and cancelReason → validated request body
* [ ] Countdown → client from verifiedAt plus etaMinutes
* [ ] Room and item labels → Stay.roomNumber and MenuItem names via joins on GET

## Acceptance criteria coverage

* AC-1 … column layout plus completed strip · AC-2 … GET shape and roles · AC-3 … verify transition · AC-4 … ETA patch · AC-5 … ready · AC-6 … served · AC-7 … cancel · AC-8 … countdown urgency · AC-9 … chime and toast · AC-10 … reconnect refetch · AC-11 … rate limits · AC-12 … bilingual copy · AC-13 … 409 recovery · AC-14 … desk read only plus gates
