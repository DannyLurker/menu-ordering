# Review, master, 2026-10-11 (stay check-in)

**Reviewed by**: muse-spark (author on unknown)
**Scope**: 22 files, uncommitted
**Verdict**: Changes requested

## Summary

Spec 0008's desk-creates / guest-sets-PIN flow is implemented end to end with clean slice boundaries, atomic single-use setup codes, uniform enumeration-safe errors, and strong route plus service test coverage (138 passing). Two majors block merge: room uniqueness rests on a non-atomic app-level snapshot while the DB partial unique index compares exact (case-sensitive) room strings, so the headline one-ACTIVE-stay invariant can be violated; and the spec's critical concurrent double-PIN-setup scenario (the `SETUP_RACE` branch) has no test. Remaining items are minor hardening and nits.

## Major

### 🟠 Room uniqueness is app-only and normalization-mismatched, `features/stays/services/stays.service.ts:174`
**Problem**: `createStay` loads all ACTIVE stays into memory, compares with `normalizeRoom` (trim/collapse/uppercase), then inserts — with no transaction or DB guard matching that comparison. The DB partial unique index (`prisma/migrations/20261010085523_data_model/migration.sql:193`) is on exact `roomNumber`, case- and spacing-sensitive, while the service stores the desk-typed form (`stays.service.ts:207`, trimmed but not uppercased). Two concurrent creates for `101a` / `101A` (or with spacing variants) both pass the snapshot check and both insert, since the index sees different strings.
**Why it matters**: Violates the spec's key invariant ("one ACTIVE stay per roomNumber at all times, enforced in DB plus checked in app") and AC-3; a double ACTIVE room corrupts ordering/mint truth downstream.
**Suggested fix**: Make the stored form match the compared form (persist the normalized room, or add a normalized column with the partial unique index on it), and handle the unique-violation error from the DB as a 409 fallback so the race degrades to the specified error instead of a duplicate row.

### 🟠 Concurrent double PIN-setup race branch is untested, `features/stays/services/stays.service.ts:266`
**Problem**: The exactly-one-winner claim rests on `consumeSetupCode` (`features/stays/repositories/stays.repository.ts:83`) returning 0 for the loser, mapped to 410 `SETUP_EXPIRED`. No test exercises this branch: the service test only covers sequential reuse, which returns earlier via the cleared-hash path (`stays.service.ts:250`), and the prove script is sequential too. The spec lists "concurrent double PIN setup with one code yields one ok plus one 410" as a critical test scenario.
**Why it matters**: The atomicity property is the load-bearing correctness claim of the whole PIN flow; without a test (e.g. two concurrent `setupStayPin` calls, or a stubbed `updateMany` returning `{count: 0}`), a future refactor can silently break single-use semantics.
**Suggested fix**: Add a test that fires two concurrent `setupStayPin` calls with the same code against the DB (or stubs `updateMany` to return 0 once) and asserts one ok plus one 410.

## Minor

### 🟡 Proxy desk gate misses the exact create path, `proxy.ts:48`
**Problem**: `DESK_API = ["/api/stays/"]` (trailing slash) never matches `POST /api/stays`, so `apiRole` returns `"any"` for the create endpoint and a KITCHEN session passes the edge gate.
**Why it matters**: Defense in depth fails at the edge; currently safe only because the route re-checks via `requireStaffRole` (`app/api/stays/route.ts:11`), but any future route that trusts the proxy alone would be exposed.
**Suggested fix**: Match the prefix without trailing slash (`"/api/stays"`), keeping the pin-setup public exemption first.

### 🟡 Unbounded full-table ACTIVE scan per create, `features/stays/repositories/stays.repository.ts:25`
**Problem**: Every stay creation loads all ACTIVE stays and filters/normalizes in JS.
**Why it matters**: Fine at hotel scale today, but unbounded memory and latency growth with no index-backed lookup; also forces the check-then-insert race above to stay wide.
**Suggested fix**: Once the normalized-room column from the Major exists, query it directly (`findFirst` by normalized room); until then, at minimum select only recent/relevant rows.

### 🟡 Desk list goes stale after create and reissue, `app/stays/checkin-form.tsx:71`
**Problem**: `CheckinForm` shows the one-time code but never refreshes the server-rendered `StayList`; the new stay (and updated PIN-set state after reissue, `app/stays/reissue-button.tsx:27`) appears only after manual navigation/reload.
**Why it matters**: AC-8 desk surface reads as broken on the happy path — the stay just created is missing from the list below it.
**Suggested fix**: Call `router.refresh()` from `next/navigation` after successful create/reissue.

### 🟡 Reissue offered on non-ACTIVE stays, `app/stays/stay-list.tsx:53`
**Problem**: Every row renders `ReissueButton`, including `CHECKED_OUT`/`CANCELLED` stays whose reissue always answers 409.
**Why it matters**: Dead-end action with a generic failure message; desk cannot tell which rows are recoverable.
**Suggested fix**: Render the reissue action only for `ACTIVE` rows (or disable with an explanatory hint).

### 🟡 PIN setup has no stay-status check, `features/stays/services/stays.service.ts:240`
**Problem**: `setupStayPin` checks `pinLocked`, code hash, and expiry, but never `status`; a `CHECKED_OUT`/`CANCELLED` stay holding a live code can still set a PIN.
**Why it matters**: Low harm (mint/order still blocked by `isStayOrderable`), but it contradicts the AC-5 spirit that inactive stays are fully inert and leaves a live credential on a dead stay.
**Suggested fix**: Reject non-ACTIVE stays in `setupStayPin` (410/409 with the uniform message), or clear `setupHash` on checkout/cancel.

### 🟡 Service unit test file writes to the live database, `features/stays/services/stays.service.test.ts:112`
**Problem**: A file named and commented as pure-function unit tests imports the real `prisma` client and creates/deletes `VT-` stays, sessions, and guests, keyed by `Date.now()` with cleanup only in `afterAll`.
**Why it matters**: Suite needs `DATABASE_URL`, is order/timing sensitive, and a mid-run failure leaves rows behind; it also blurs what is unit vs integration coverage.
**Suggested fix**: Split the DB-backed orchestration blocks into an integration test file (or gate/skip without DB) and keep pure-helper tests isolated.

## Nits

- ⚪ `lib/rate-limit.ts:106`, duplicated JSDoc block above `takeBudget` (two identical comments).
- ⚪ `app/api/stays/pin-setup/route.ts:33`, `stayId || "unknown"` is dead — Zod already requires a non-empty stayId.
- ⚪ `proxy.ts:67`, public exemption matches only exact `/api/stays/pin-setup`; a trailing-slash variant would fall into the staff gate.
- ⚪ `features/stays/services/stays.service.ts:108`, modulo-wrap flags `789012`-style runs as weak — safe direction, slightly stricter than the spec's listed blocklist.
- ⚪ Zod shape failures answer 422 while spec AC-1 says 400; consistent with the codebase convention, but the spec table still says 400.

## Strengths

- Atomic single-use PIN setup via conditional `updateMany` with hash, expiry, and lock re-checked in the write — the race is closed by construction, not by ordering.
- `timingSafeEqual` on setup hashes, SHA-256-only storage, bcrypt temp PIN from 32 random bytes, and zero secrets in logs or responses.
- Uniform invalid/expired messages that do not leak stay existence or PIN state, verified by a test asserting the stay id never appears in the body.
- Throttle-before-DB with 422-before-budget ordering, per-stay plus per-IP budgets, `Retry-After` propagation, and a separate hourly bucket for desk reissue.
- `generateSetupCode` draws from a 32-char alphabet with `byte % 32` where 256 % 32 == 0, so there is no modulo bias; collision space (~1T) fits the unique index.
- Thin routes, rules in services, queries in repositories, Prisma passed down — the project's scope conventions are followed throughout.

## Test coverage

Covered: date rules, weak-PIN screen, code shape/hash, masking, normalization (unit); create/duplicate/409/list ordering, PIN set/clear/reuse/lock/expiry, reissue rotate/kill/404/409 (service, DB-backed); create 400/422/409/gate, pin-setup 422/weak/mismatch/unknown/410/423/429-with-retry-hint, reissue 404/409/gate (route, stubbed DB); guest link builder; full suite green (20 files, 138 tests). Gaps: concurrent double-use race branch (Major above); reissue hourly throttle and idempotency-window expiry untested; no UI tests for the desk/guest forms (acceptable — bilingual copy and states are simple, covered by build/verify).
