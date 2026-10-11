# Verify: PIN hashing on bcryptjs · spec 0005 · updated 2026-10-11
_Steps derived from spec 0005 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._
## UI / manual
- [x] None: no screens change in this feature.
## Commands
- [x] `pnpm tsx scripts/prove-auth-and-roles.ts` (after `next build`) → PROVE PASS including `scrypt row mints (compat verify)` and `row upgraded to bcrypt after match` → AC-2, AC-3, AC-4
- [x] `pnpm vitest run features/stay-session/pin.test.ts` → 8 of 8 pass (bcrypt format and cost, scrypt compat, malformed rows fail closed) → AC-1, AC-2, AC-5, AC-6
- [x] `pnpm tsx scripts/prove-data-model.ts` → PROOF PASS (async callers hold) → AC-4, AC-6
- [x] `pnpm tsc --noEmit`, `pnpm eslint` on touched files, `next build` → all clean → build hygiene
- [x] `SELECT left("pinHash", 4) FROM "Stay" WHERE id = 'seed-stay-demo'` after seed plus one mint → `$2b$` → AC-1, AC-3
- [x] `SELECT count(*) FROM "Stay" WHERE "pinHash" LIKE 'scrypt$%'` → trends toward zero through normal guest use; dormant rows still verify → AC-2, migration convergence
## Acceptance-criteria coverage
- AC-1 covered by unit format and cost test plus demo stay row read
- AC-2 covered by scrypt compat unit test plus prove compat mint
- AC-3 covered by prove row upgrade check
- AC-4 covered by unchanged auth prove walk plus data model prove
- AC-5 covered by malformed row tests plus no secrets in logs
- AC-6 covered by async signatures at service, seed, prove, and tests
