# 0006. Staff passwords on bcryptjs through the BetterAuth API

**Date**: 2026-10-11
**Status**: Accepted

## Summary

Staff password hashing moves to bcryptjs, configured as the hasher inside BetterAuth itself, and every account write (create, reissue, seed) goes through BetterAuth API seams instead of direct database writes. Sign in, password change, lockout, and temp flows keep working exactly as today. Guest PINs stay on their own path from spec 0005.

## Context

Staff credentials are written in three places with direct database calls that hash through an internal BetterAuth crypto import: admin creation, temp reissue, and the seed script. That works, but it splits hashing authority in two: BetterAuth verifies with its configured hasher while app code hashes with an imported utility, and nothing but discipline keeps the two in agreement. Your agreement 5 and the scope hashing direction ask for one vetted authority, and you chose bcryptjs with creation through the BetterAuth API. The database was reset and the app is still in development, so no old staff hash needs compat: every row from here on is bcrypt. The open design points are which API seam creates accounts, where bcrypt plugs into BetterAuth, and what happens to the direct write code.

## Requirements

**User stories**:

- As an admin, I want staff creation to hash through the same authority that verifies sign in, so the two can never disagree.
- As a staffer, I want sign in, temp change, and lockout to behave exactly as before so nothing about my day changes.

**Acceptance criteria**:

- **AC-1**: A staff account created by an admin stores a bcrypt credential row and signs in with the temp secret on first try.
- **AC-2**: Temp reissue rotates through the API path; the old temp stops working and the new temp signs in.
- **AC-3**: The seed admin is created through the API path with a bcrypt row and rotates at first sign in as today.
- **AC-4**: Temp change, lockout and cooldown, self guard, stay unlock, mint, and revoke behave exactly as today; the full auth prove walk passes unchanged.
- **AC-5**: No plain password reaches storage or logs, and no code outside the BetterAuth seams writes User or credential Account rows.

## Options considered

### Option 1: Internal adapter seams plus configured bcrypt hasher

Set the bcrypt hasher in the BetterAuth email and password config, and write accounts through `auth.$context.internalAdapter` (`createUser` plus credential link on create, `updatePassword` on reissue). Reads, lock counters, role writes, and session deletes stay direct database calls.

**Pros**:

- One hashing authority: config owns hash and verify together, so creation and sign in agree by construction.
- Works with public sign up still disabled and writes the role atomically with the user.

**Cons**:

- Couples to a semi internal API surface that can shift across BetterAuth majors; the version pin becomes load bearing.
- Developers must learn the seam instead of plain database calls.

### Option 2: Lift disableSignUp and gate the public endpoint

Enable public sign up in config and restrict the sign up endpoint to admin sessions at the edge and server layers.

**Pros**:

- Uses only the documented public endpoint surface, no internal API.

**Cons**:

- Opens an auth endpoint to the network that must then be fenced perfectly; a gate bug becomes an open registration.
- More moving parts than a server side call for an operation only admins ever perform.

### Option 3: Admin plugin

Install the BetterAuth admin plugin and use its user management endpoints.

**Pros**:

- Managed create, ban, and impersonation endpoints out of the box.

**Cons**:

- Reverses the no plugin decision from spec 0004 for machinery this hotel never uses.
- Plugin user fields and permissions add concepts every later slice must carry.

## Decision

**Chosen option**: Option 1: Internal adapter seams plus configured bcrypt hasher

Staff passwords hash with bcryptjs through the BetterAuth password config, and all account writes go through the internal adapter seams.

## Rationale

The deciding force is single hashing authority: with the hasher in config, the same functions that write temp secrets verify them at sign in, which removes the failure mode of today where only discipline keeps two separate code paths in agreement. The internal adapter is the narrowest seam that satisfies your direction: it runs server side with public sign up still disabled, accepts the role column in the same call, and was verified present in the installed build. The public endpoint option spends security budget fencing a route nobody public should reach, and the admin plugin buys a permission system for three roles in one hotel.

## Feature design

**Data model sketch**:

No schema change. `User` and credential `Account` rows keep their shape; only the `Account.password` value format changes to bcrypt. User ids come from BetterAuth id generation at creation time instead of caller made UUIDs, same uniqueness guarantee.

**API surface**:

No HTTP change. The seam changes are internal:

| Call | Purpose | Key inputs | Key outputs |
| :--- | :------ | :--------- | :---------- |
| `internalAdapter.createUser` plus credential link | admin create, seed first admin | name, email, role, bcrypt hashed temp | user id |
| `internalAdapter.updatePassword` | temp reissue | user id, new temp | rotated row, old temp dead |
| configured `password.hash` and `password.verify` | hash on write, check on sign in | plain secret, stored row | hash row, match result |

**Value sourcing**:

| Action | Value produced or displayed | Source |
| :----- | :-------------------------- | :----- |
| Temp hash row | bcrypt credential value | configured password hash (bcryptjs cost 10) of the server random temp, decided here |
| Sign in match | accept or reject | configured password verify of input against the stored row, decided here |
| Staff role | `FRONT_DESK`, `KITCHEN`, or `ADMIN` | zod validated admin input, decided in spec 0004 |
| Temp secret | 16 alphanumeric chars | server random generator, decided in spec 0004 |
| User id | new row identity | BetterAuth id generation at creation, decided here |
| Must change flag | forced rotation | set true at creation and reissue, decided in spec 0004 |

**Key invariants**:

- Every User and credential Account write passes through the BetterAuth seams; direct writes to those rows stop.
- Reads, lock counters, role and disable writes, and session deletes stay direct database calls in the repository.
- Lockout counting, temp change gate, self guard, and stay session behavior are untouched.
- Secrets never reach storage or logs; only hashes persist.
- Cost factor stays 10, matching the PIN decision.

**Security model**:

Hashing and account writes run server side only: admin routes (admin session), the password change route (own session), and the seed script (env secrets). Guests never touch this surface. No compliance scope beyond staff emails plus guest names, as in spec 0004.

**Configuration required**:

None. No new env vars. Bcryptjs 3.0.3 is already installed; no download is owed.

**Critical test scenarios**:

- Happy path: admin creates kitchen staff through the seam, bcrypt row stored, temp signs in, verifies **AC-1**.
- Rotation case: reissue kills the old temp and the new temp signs in, verifies **AC-2**.
- Seed case: fresh database seeds the admin through the seam and first sign in forces rotation, verifies **AC-3**.
- Regression case: full auth prove walk passes unchanged, verifies **AC-4**.
- Authority case: grep finds no direct User or credential Account writes outside the seams, verifies **AC-5**.

## Build plan

Ordered thin thread first: hasher config, then writes, then callers, then gates.

1. Bcrypt hasher in the BetterAuth password config at cost 10, satisfies **AC-1**.
2. Creation plus reissue plus seed through the internal adapter seams, satisfies **AC-1, AC-2, AC-3**.
3. Retire direct credential writes in the repository; keep reads, lock counters, role writes, and session deletes, satisfies **AC-4, AC-5**.
4. Gates: typecheck plus lint plus build plus unit tests plus the auth prove walk unchanged, satisfies **AC-4**.

## Consequences

**Positive**:

- Hashing authority lives in exactly one place, so creation and verification agree by construction instead of by discipline.
- App code drops its private crypto import; framework upgrades to hashing flow through config.
- Role, temp flag, and credential land in one adapter call instead of a hand assembled transaction.

**Negative / tradeoffs**:

- The `$context` internal adapter is a semi internal surface; a BetterAuth major may move it, so the version pin is load bearing and upgrades need a seam check.
- Pure JavaScript hashing is slower than native; irrelevant at staff sign in volume but real.

**Neutral**:

- Guest PINs stay on the spec 0005 path, untouched by this spec.
- No schema or migration SQL; the format lives in the value, not the column.
- No compat layer: the reset database makes every staff row bcrypt from birth.

## Follow-up

- [ ] Pointer cells: note this spec on the creation path cell of spec 0004 and the staff password cell of spec 0005 when confirming, so the reversed cells trace forward.
- [ ] Library permission log: bcryptjs usage widens from PINs to staff secrets with no new download; record it in the build report.
- [ ] Watch BetterAuth majors for internal adapter moves before upgrading past the pinned line.

## Rationale

Reasoning and options: see above (`## Options considered` plus the decision rationale). Single file spec keeps the record inline.
