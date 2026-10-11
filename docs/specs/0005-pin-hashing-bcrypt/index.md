# 0005. PIN hashing on bcryptjs with scrypt compat

**Date**: 2026-10-11
**Status**: Accepted

## Summary

Guest stay PINs move from hand rolled scrypt to the peer reviewed bcryptjs library (a widely used password hashing package, zero dependencies). Old scrypt rows keep verifying, and the first successful check on one transparently upgrades it to bcrypt. Staff passwords stay on BetterAuth built in hashing; this change touches PINs only.

## Context

Stay PINs are hashed app side in `features/stay-session/pin.ts` with a hand assembled construction: random salt plus Node scrypt plus a `scrypt$salt$hash` text format plus a manual timing safe compare. It works and the prove walk covers it, but every line of it is custom cryptography code the team now owns forever: salt generation, parameter choice, format parsing, and compare logic. Your working agreement 5 says a vetted outside library should get the job when one exists, and you picked bcryptjs for this one. The constraint is continuity: the demo stay and any real stays already store scrypt rows, and plain PINs are never stored anywhere, so no migration can recompute hashes up front. Whatever ships must read both formats and converge on one without a flag day.

## Requirements

**User stories**:

- As a guest, I want my existing PIN to keep working after the change so I am never locked out by an upgrade I cannot see.
- As a front desk staffer, I want PIN lockout and unlock to behave exactly as before so recovery flows need no retraining.

**Acceptance criteria**:

- **AC-1**: A newly set PIN stores as a bcrypt row (cost 10, `$2b$` format) and verifies with the correct PIN.
- **AC-2**: An existing `scrypt$` row verifies with the correct PIN and rejects a wrong PIN, byte for byte as before.
- **AC-3**: A successful verify against a `scrypt$` row re hashes with bcrypt and updates the row; the next verify takes the bcrypt path.
- **AC-4**: Lockout counting, lock messages, mint, revoke, and unlock behave exactly as today; the full auth prove walk still passes unchanged.
- **AC-5**: No plain PIN ever reaches storage or logs; the scrypt branch keeps its timing safe compare and the bcrypt branch uses the library compare.
- **AC-6**: `hashPin` and `verifyPin` are async; every caller (service, seed, prove setup, unit tests) awaits them.

## Options considered

### Option 1: bcryptjs with lazy rehash on verify

New PINs hash with bcryptjs (async API, cost 10). Verify branches on the stored prefix: `scrypt$` rows check the old way, `$2b$` rows use the library compare. A successful scrypt match re hashes with bcrypt and updates the row before returning.

**Pros**:

- Old rows work from the first deploy with no data migration and no staff action.
- Table converges to one format through normal guest use.

**Cons**:

- Two verify paths coexist until the last scrypt row turns over.
- Rollback after rehashes needs staff PIN resets for migrated stays (old code cannot read bcrypt rows).

### Option 2: Keep the hand rolled scrypt

Change nothing; keep owning the salt, params, format, and compare code.

**Pros**:

- Zero churn, zero new dependency, fastest hashing (native code).
- No rollback hazard at all.

**Cons**:

- Custom cryptography stays in the codebase permanently against your agreement 5.
- Any future reviewer must re audit the construction by hand instead of trusting a standard primitive.

### Option 3: Native bcrypt binding

Same algorithm through the compiled `bcrypt` package instead of pure JavaScript.

**Pros**:

- Fastest verify path of the three options.

**Cons**:

- Native build toolchain on every install and every Docker build; a heavier operational cost for a hotel app that verifies a handful of PINs per hour.
- Prebuilt binaries lag new Node releases, which has blocked upgrades for teams before.

## Decision

**Chosen option**: Option 1: bcryptjs with lazy rehash on verify

PIN hashing moves to bcryptjs 3.x with async calls and cost factor 10, old scrypt rows keep verifying, and a successful scrypt match upgrades the row to bcrypt on the spot.

## Rationale

The deciding force is your agreement 5: a vetted primitive replaces custom cryptography. Bcryptjs carries roughly ten million weekly downloads with zero dependencies and ships its own types, so the team stops owning salt handling and compare logic. Cost 10 is the library default and the right weight here because brute force protection comes from the five miss lockout, not from hash cost, and six digit PINs gain almost nothing from a heavier factor. Async calls matter because bcryptjs runs in pure JavaScript; the async API yields the event loop between chunks instead of blocking mint requests. Native bcrypt was rejected on operational cost: this app checks a few PINs per hour, so trading the build toolchain for speed solves no measured problem. The lazy upgrade beats dual format forever because the table converges without staff action, and it beats a flag day because a flag day is impossible without the plain PINs.

## Feature design

**Data model sketch**:

No schema change: `Stay.pinHash` stays text. Row format contract, detected by prefix:

| Format | Shape | Written by | Verified by |
| :----- | :---- | :--------- | :---------- |
| scrypt (old) | `scrypt$saltHex$derivedHex` | code before this spec | old recompute plus timing safe compare |
| bcrypt (new) | `$2b$10$...` (library native output) | this spec onward | library compare |

**State transitions**:

Stored PIN format moves one way only: `scrypt` to `bcrypt`, on the first successful verify of that row. No downgrade path exists. `pinSetAt` is untouched by rehash (the guest did not set a new PIN). `failedPinAttempts` reset on success stays as today.

**API surface**:

No HTTP change. `pin.ts` signatures change to async:

| Function | Inputs | Output | Errors |
| :------- | :----- | :----- | :----- |
| `hashPin(pin)` | PIN string | bcrypt hash string | throws on empty input |
| `verifyPin(pin, stored)` | PIN string, stored row | true or false, never throws on bad format | false for unknown prefixes |

**Value sourcing**:

| Action | Value produced or displayed | Source |
| :----- | :-------------------------- | :----- |
| Set PIN | bcrypt hash row | bcryptjs hash of the input PIN at cost 10, decided here |
| Verify bcrypt row | match result | library compare of input against the stored row, decided here |
| Verify scrypt row | match result | scrypt recompute plus timing safe compare per the spec 0002 format |
| Rehash write | replacement row | fresh bcrypt hash of the just verified PIN, triggered by a successful scrypt match |
| Cost factor | 10 | decided here (library default; lockout carries brute force defense) |
| Format branch | which verify path | stored row prefix (`scrypt$` versus `$2b$`), no configuration |

**Key invariants**:

- Every `scrypt$` row verifies exactly as before until its first successful match upgrades it.
- Lockout counting, lock and cooldown messages, mint single session rule, revoke, and unlock are untouched.
- Secrets never reach storage or logs; only hashes persist.
- All hashing calls are async; no sync bcryptjs call runs on a request path.

**Security model**:

Hashing runs server side only: the mint path (already LRU limited plus PIN locked) and the seed script (secret from env). Guests never see hashes. No card data anywhere; no compliance scope beyond staff emails plus guest names, as in spec 0004.

**Configuration required**:

None. No new env vars. One library install is owed at build time: `bcryptjs` 3.x, requested by you through the scope hashing note and this spec; per working agreement 1 `/develop` asks your install permission again before downloading it.

**Critical test scenarios**:

- Happy path: new PIN hashes to `$2b$` and verifies, verifies **AC-1, AC-6**.
- Compat case: old scrypt row verifies, then its row reads `$2b$` on the next read, verifies **AC-2, AC-3**.
- Failure case: wrong PIN on either format fails closed with no format oracle, verifies **AC-2, AC-5**.
- Regression case: full auth prove walk passes unchanged, verifies **AC-4**.

## Build plan

Ordered thin thread first: hasher, then upgrade path, then callers, then gates.

1. Rewrite `pin.ts` on bcryptjs async with cost 10 plus prefix branched verify, satisfies **AC-1, AC-2, AC-5, AC-6**.
2. Lazy rehash in the stay session service on scrypt match, satisfies **AC-3**.
3. Await at callers: seed, prove setup, `pin.test.ts` plus new bcrypt and compat cases, satisfies **AC-1 to AC-6**.
4. Gates: typecheck plus lint plus build plus unit tests plus the auth prove walk unchanged, satisfies **AC-4**.

## Migration plan

**Strategy**: strangler (old and new verify paths side by side, table converges through use, no data migration).
**Phases**:
1. Ship dual verify with bcrypt writes for new PINs; scrypt rows keep working untouched.
2. Normal guest use upgrades rows on successful verify; an audit query counting `scrypt$` prefixed rows shows convergence.
**Rollback**: redeploy the prior code. Honest limit: stays already upgraded to bcrypt cannot verify on old code (it answers wrong PIN), so a late rollback needs staff PIN resets for migrated stays; forward fix is preferred over rollback.
**Risks**: a long tail of dormant scrypt rows if guests rarely sign in (harmless, they still verify); pure JavaScript hashing costs roughly a tenth of a second per call at cost 10 (fine at hotel volume, already budgeted by the mint rate limiter).

## Consequences

**Positive**:

- Custom cryptography leaves the codebase; salt, cost, format, and compare become the library's tested responsibility.
- Stored rows become a standard format any future tooling reads without project specific parsing.
- Async calls stop hashing from blocking the event loop on mint and seed paths.

**Negative / tradeoffs**:

- One more runtime dependency to own and upgrade.
- Hashing gets slower (pure JavaScript versus native scrypt); irrelevant at this volume but real.
- Late rollback after rehashes needs staff PIN resets, stated in the migration plan.

**Neutral**:

- Staff passwords moved to bcryptjs through the BetterAuth API seams in spec 0006; this spec now covers PINs only.
- No schema or migration SQL: `pinHash` stays text and the format lives in the value, not the column.
- `pin.test.ts` grows bcrypt plus compat cases beside the existing scrypt cases.

## Follow-up

- [ ] bcryptjs install approval at `/develop` time per working agreement 1 (requested here, download still needs your yes).
- [ ] Library permission log: record the bcryptjs request and approval alongside the zod entry when the build runs.
- [ ] Consider a pre build pass with the installed security review skill over the new verify branching; optional, not blocking.
- [ ] Scope hashing note says `/architect` deliberates before build: this spec is that deliberation; point the note at spec 0005 when confirming.

## Rationale

Reasoning and options: see above (`## Options considered` plus the decision rationale). Single file spec keeps the record inline.
