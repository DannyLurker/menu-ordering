# Verify: real time foundation and rate limiting · spec 0007 · updated 2026-10-11
_Steps derived from spec 0007 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## Commands
- [x] `pnpm tsx scripts/prove-realtime.ts` → all green (11 checks: denies, ignore, budgets, 429 shape, stay plus kitchen joins) → AC-3, AC-4, AC-6, AC-8
- [x] `npx vitest run lib/realtime.test.ts lib/rate-limit.test.ts` → pass (payload keys exact, budgets, retry timing, 429 shape) → AC-1, AC-2, AC-6, AC-7, AC-8
- [x] `npx tsc --noEmit` → clean; `next build` → green → build integrity
- [x] Emit helper without a booted server returns false after validating payload (covered in unit tests via payload builders) → AC-1, AC-2, AC-4

## UI / manual (needs a running server plus seed data)
- [x] Guest mints stay via PIN → socket `join.stay` acks ok:true with room `stay:stay:{id}`; other stay rooms deny → AC-3
- [x] Kitchen signs in → `join.kitchen` acks ok:true with room `kitchen:board`; desk sign in gets FORBIDDEN → AC-3
- [ ] Order create (once slice 7 lands and calls the emit helper) → kitchen plus owning stay update with no refresh → AC-1
- [ ] Status plus ETA change (once slice 8 lands) → both rooms update live → AC-2
- [ ] Drop network → reconnect → client rejoins plus refetches REST with an updated note; focus does the same (debounced) → AC-5
- [x] Six rapid mints → sixth answers 429 RATE_LIMITED with retryAfter plus Retry-After header → AC-6
- [ ] Order creates past 20 per stay (slice 7) → 429 with wait copy; PIN locked stay → call staff copy → AC-7
- [x] Wrong PIN plus bad session answers stay generic; server logs plus deny bodies carry ids only, no PIN, token, or password → AC-8

## Value sourcing coverage (one step per row)
- Room names derived server side: stay join lands only in its own room (prove: stay join lands in its own room)
- Emit payload keys exact: unit test asserts keys stayId, orderId, status, etaMinutes only
- Throttle keys plus budgets: prove mint 429 plus join probe budget checks
- Retry timing: prove asserts retryAfterSec above zero; unit test bounds it by the window
- Lock truth across restarts: durable columns covered by the auth prove walk (spec 0004)
- Client IP derivation: unit test prefers forwarded, then real ip, then unknown
- Log redaction: prove asserts deny bodies echo no token

## Acceptance-criteria coverage
- AC-1 … prove stay join plus unit payload (live fanout lands with slice 7) · AC-2 … unit payload (live fanout lands with slice 8) · AC-3 … prove denies plus desk FORBIDDEN · AC-4 … prove ignore check · AC-5 … join on connect regression test (fails before, passes after the debug fix); browser reconnect plus focus pass stays a slice 1 manual step · AC-6 … prove 429 shape plus probe budget · AC-7 … helper budgets plus unit tests, enforcement lands with slice 7 · AC-8 … prove no echo plus unit key set
