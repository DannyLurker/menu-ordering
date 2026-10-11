# Verify: staff passwords on bcryptjs API · spec 0006 · updated 2026-10-11
_Steps derived from spec 0006 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._
## UI / manual
- [x] None: no screens change in this feature.
## Commands
- [x] `pnpm tsx scripts/prove-auth-and-roles.ts` (after `next build`) → PROVE PASS: temp sign in, forced rotation, reissue killing the old temp, lockout, self guard → AC-1, AC-2, AC-4
- [x] Fresh database plus `pnpm tsx prisma/seed.ts` → admin created through the seam, first sign in forces rotation → AC-3
- [x] `pnpm tsc --noEmit`, `pnpm eslint` on touched files, `next build`, `pnpm vitest run` → all clean → build hygiene
- [x] Grep app code for `prisma.user.create`, `prisma.account.create`, `prisma.account.updateMany`, and `better-auth/crypto` → no matches outside skill docs → AC-5
- [x] `SELECT left(password, 7) FROM "Account" WHERE "providerId" = 'credential'` after create or reissue → `$2b$10$` → AC-1, AC-2
- [x] Focused reissue walk on a scratch server: old temp 401 after reissue, new temp 200 → AC-2
## Acceptance-criteria coverage
- AC-1 covered by seam creation plus temp sign in plus bcrypt row read
- AC-2 covered by reissue rotation in the prove walk
- AC-3 covered by seed through the seam plus forced rotation
- AC-4 covered by unchanged auth prove walk
- AC-5 covered by grep authority checks
