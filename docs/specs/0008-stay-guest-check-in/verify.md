# Verify: stay and guest check in · spec 0008 · updated 2026-10-11

_Steps derived from spec 0008 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

- [x] Sign in as front desk → open `/stays` → check in a guest → expect the setup code shown once with copy → AC-1
- [x] Submit the same check in twice → expect the same stay with a fresh code and a duplicate note → AC-1
- [x] Check in a second guest to the same live room → expect 409 naming the checkout date → AC-3
- [x] Open `/guest/setup?stay=<id>` → confirm room plus masked name → set a PIN → expect success → AC-2, AC-8
- [x] Set PIN `123456` → expect weak rejection → AC-2
- [x] Reuse a consumed setup code → expect 410 invalid or expired → AC-2
- [x] Reissue a code from the stay list → expect the new code works and the old one fails → AC-6
- [x] Mint for a checked out stay → expect bilingual 403 contact desk → AC-5
- [x] Fail setup six times in 15 minutes → expect 429 with retry and call desk copy → AC-7
- [x] Vary the value sources: lowercase plus spaced room still hits 409 (normalization) · checkout day edge follows UTC day · lowercase setup code accepted (case insensitive hash) → AC-3, AC-4, AC-5, AC-2
- [x] Desk plus guest screens read fully in EN plus ID with empty plus error plus loading states and labeled fields → AC-8

## Commands

- [x] `pnpm exec vitest run` → 107 pass with no regressions → AC-1 to AC-8
- [x] `pnpm exec tsx scripts/prove-stay-checkin.ts` → PROOF PASS → AC-1 to AC-6
- [x] `pnpm build` → green with `/api/stays`, `/api/stays/pin-setup`, `/api/stays/[id]/reissue`, `/stays`, `/guest/setup` → AC-1, AC-2, AC-6, AC-8

## Acceptance-criteria coverage

- AC-1 covered by desk create plus double submit steps and the prove script
- AC-2 covered by guest set plus weak plus reuse steps and the prove script
- AC-3 covered by the room taken step and the prove script
- AC-4 covered by the prove script date rule steps
- AC-5 covered by the expired mint step and the prove script
- AC-6 covered by the reissue step and the prove script
- AC-7 covered by the throttle step and the rate limit unit tests
- AC-8 covered by the language and states step
