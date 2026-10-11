# Verify: auth and roles · spec 0004 · updated 2026-10-11
_Steps derived from spec 0004 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual
- [ ] Sign in as admin with the seed secret → forced to `/change-password` → set a real password → lands on `/staff` → AC-1, AC-8
- [ ] Admin creates kitchen staff → temp secret shows once → staffer signs in → forced password change → lands on `/kitchen` → AC-1, AC-2, AC-8
- [ ] Kitchen opens `/staff` → bounced to `/kitchen`; desk opens `/kitchen` → bounced to `/stays`; signed out visitor opens `/stays` → `/sign-in` → AC-2, AC-4
- [ ] Guest mints with the correct PIN → stay cookie set → second device mint → 409 with reuse hint → sign out → mint again works → AC-3
- [ ] Five wrong staff passwords → generic 401s naming neither account nor field → correct password still cools down with 423 after a server reboot (durable) → admin unlock → sign in works → AC-4, AC-5
- [ ] Five wrong PINs → 401 ask again → sixth mint → 403 locked with call staff message → desk unlock → correct PIN mints → AC-7
- [ ] Checked out stay mints → 403; checkout with a live session revokes it (Slice 1 checkout calls `revokeStaySessionsForStay`) → AC-6
- [ ] Admin PATCH self with `isDisabled: true` or a non admin role → 403 self guard → AC-8
- [ ] Mint response `expiresAt` equals checkout day 12:00 WIB (05:00 UTC), capped at 30 days out; stays past checkout mint → 403 → AC-3 value edge
- [ ] Temp secret is 16 alphanumeric chars, shown once, never in logs (grep `console` in `lib/` and `app/api/`) → AC-8 value edge

## Commands
- [ ] `pnpm prisma migrate status` → up to date, 3 migrations → AC-2, AC-3, AC-5
- [ ] `pnpm tsc --noEmit` → clean; `pnpm eslint` on touched files → clean → build hygiene
- [ ] `next build` → passes, routes `ƒ` dynamic, `ƒ Proxy (Middleware)` present → AC-2, AC-4
- [ ] `pnpm tsx prisma/seed.ts` → seed ok lines, admin skipped or rotated with a log line → AC-8
- [ ] `pnpm tsx scripts/prove-auth-and-roles.ts` (after `next build`) → PROVE PASS, 35 checks → AC-1 to AC-8

## Acceptance-criteria coverage
- AC-1 covered by sign in steps, generic 401 probe, and prove steps 1 to 3
- AC-2 covered by bounce steps, 403 API probes, and prove steps 3, 4, 6
- AC-3 covered by mint plus 409 plus revoke walk and prove step 7
- AC-4 covered by redirect steps and prove steps 3, 5
- AC-5 covered by lockout plus reboot plus 429 steps and prove steps 5, 9
- AC-6 covered by checked out mint step and prove step 8
- AC-7 covered by PIN lock plus unlock steps and prove step 7
- AC-8 covered by temp change, reissue, and self guard steps and prove steps 1, 2, 6, 10
