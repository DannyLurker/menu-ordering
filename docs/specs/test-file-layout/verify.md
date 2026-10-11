# Verify: test file layout · scope folder structure · updated 2026-10-11
_Steps derived from scope.md layer rule 4 plus test preferences. `/check verify` runs these. `/test` locks the durable ones._

## Commands
- [ ] `pnpm vitest run features/stay-session/pin.test.ts lib/db.test.ts` → 11 pass
- [ ] `pnpm vitest run prisma/data-model.test.ts` → pass once local Postgres runs with migrations applied

## Manual
- [ ] No `tests/` folder exists at repo root
- [ ] `features/stay-session/pin.test.ts` sits beside `features/stay-session/pin.ts`
- [ ] `lib/db.test.ts` sits beside `lib/db.ts`
- [ ] `prisma/data-model.test.ts` sits beside `prisma/schema.prisma`
- [ ] `scripts/prove-auth-and-roles.ts` plus `scripts/prove-data-model.ts` stay in `scripts/`
- [ ] `test-preferences.json` shows `testDir` as `beside the source` plus `filePattern` as `*.test.ts`
