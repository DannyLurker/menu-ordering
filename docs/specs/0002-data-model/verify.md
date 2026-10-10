# Verify: data model · spec 0002 · updated 2026-10-10
_Steps derived from spec 0002 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._
## UI / manual
- [x] Seed then proof: `pnpm tsx prisma/seed.ts` shows seed ok, then `pnpm tsx scripts/prove-data-model.ts` ends PROOF PASS        → AC-1 to AC-9
- [x] Wrong PIN five times on one stay locks it with call staff message, correct PIN on another stay still works        → AC-2, AC-5
- [x] Folio balance for the proof stay equals lines sum minus RECORDED payments in whole rupiah        → AC-9
## Commands
- [x] `pnpm prisma migrate status` shows database in sync with no pending migrations        → AC-1 to AC-9
- [x] `pnpm prisma validate` passes on `prisma/schema.prisma`        → AC-1 to AC-9
- [x] `pnpm tsc --noEmit` passes with no errors        → AC-1 to AC-9
- [x] `pnpm exec vitest run` shows 21 passed: CHECK plus uniqueness guards hold on the live schema        → AC-1, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9
- [x] Seed log shows no plain PIN in output        → AC-5
## Acceptance-criteria coverage
- AC-1 covered by proof steps stay validity plus expired stay plus PENDING order · AC-2 by PIN verify plus lockout · AC-3 by seed menu plus availability checks · AC-4 by verify creates folio lines · AC-5 by hashed PIN plus 5 miss lock · AC-6 by transitions plus cancel path · AC-7 by ETA range check · AC-8 by RECORDED payment row · AC-9 by balance reconcile
