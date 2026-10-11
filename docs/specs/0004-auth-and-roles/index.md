# 0004. Auth and roles

**Date**: 2026-10-10
**Status**: Accepted

## Summary

This spec gives every actor in the hotel menu ordering app a proven identity (a way to prove who they are on each request). Staff sign in with email plus password and carry one of three roles (front desk, kitchen, admin). Guests trade a correct stay PIN for a stay bound session (a server side record tying later requests to one stay). Every later slice checks these identities instead of inventing its own gates.

## Requirements

**User stories**:

- As a front desk staffer, I want to sign in and reach only desk screens so I can check guests in.
- As a kitchen staffer, I want to sign in and reach only the kitchen board so I can verify orders.
- As an admin, I want to create staff accounts with roles so each person reaches only their screens.
- As a guest, I want one PIN entry to cover my whole stay so I am not asked again on every order.

**Acceptance criteria**:

- **AC-1**: A staffer signs in with email plus a correct password and lands on their role home; a wrong password fails with a generic message that names neither the account nor the field.
- **AC-2**: Each role reaches only its own screens and APIs: desk cannot verify orders, kitchen cannot manage staff or menu, guests cannot reach any staff surface.
- **AC-3**: A correct stay PIN mints exactly one live stay session bound to that stay; later requests on it resolve to the same stay with no new PIN entry.
- **AC-4**: An expired staff session redirects to sign in; an expired or revoked stay session asks for the PIN again; neither leaks data before the gate.
- **AC-5**: Five wrong staff passwords trigger a cooldown; the count is durable across restarts.
- **AC-6**: Checkout revokes the stay session at once; a checked out stay cannot mint a new one.
- **AC-7**: PIN lock on a stay revokes its live stay session; only staff unlock restores access.
- **AC-8**: A staffer created with a temporary password must set a real one before reaching any screen; an admin cannot demote or disable themselves.

## Decision

**Chosen option**: Option 1: BetterAuth roles plus a stay session table

You build staff identity on BetterAuth 1.7 email plus password with cookie sessions (a small signed browser cookie naming the session) plus a required role column on the user, and guest identity on a new `StaySession` table holding hashed tokens bound to one stay, with edge gates in `proxy.ts` (the Next.js edge checkpoint every request passes) plus server side rechecks on sensitive routes.

**Implementation skills**: `better-auth-best-practices` (`better-auth/skills`, `.agents/skills/better-auth-best-practices/`) · `better-auth-email-password-and-sessions` (`better-auth/skills`, `.agents/skills/better-auth-email-password-and-sessions/`) · `better-auth-nextjs-integration-and-route-protection` (`better-auth/skills`, `.agents/skills/better-auth-nextjs-integration-and-route-protection/`) · `prisma-client-api` (`prisma/skills`, `.agents/skills/prisma-client-api/`) · `prisma-orm-setup` (`prisma/skills`, `.agents/skills/prisma-orm-setup/`)

## Feature design

**Data model sketch**:

BetterAuth base fields stay exactly as in spec 0001. This spec only adds columns. No plugin. No change to base path `/api/auth`. No change to email plus password plus cookie sessions.

| Entity                        | Attributes                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Relationships                        | Rules                                                                                                                                                                                                                        |
| :---------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **User (BetterAuth plus this spec)** | Base (owned by BetterAuth, untouched): `id` (String, `@id`), `name` (String), `email` (String, `@unique`), `emailVerified` (Boolean), `image` (String, optional), `createdAt` (DateTime), `updatedAt` (DateTime). Added by this spec: `role` (`StaffRole`, req), `failedSignInAttempts` (Int, default `0`), `lockedUntil` (DateTime, optional), `mustChangePassword` (Boolean, default `false`), `isDisabled` (Boolean, default `false`) | 1 to N `Session`<br>1 to N `Account` | Mapped to `user` table. Email stays unique per login. Base fields managed by BetterAuth. Added columns written by server only. `StaffRole` is `FRONT_DESK` plus `KITCHEN` plus `ADMIN`.                                       |
| **Session (BetterAuth)**      | `id` (String, `@id`), `userId` (String, FK), `token` (String, `@unique`), `expiresAt` (DateTime), `ipAddress` (String, optional), `userAgent` (String, optional), `createdAt` (DateTime), `updatedAt` (DateTime)                                                                                                                                                                                                                                                              | N to 1 `User`                        | Mapped to `session` table. Indexed on `userId`. Owned and managed by BetterAuth for HTTP only cookie sessions. Untouched by this spec.                                                                                        |
| **Account (BetterAuth)**      | `id` (String, `@id`), `userId` (String, FK), `accountId` (String), `providerId` (String), `accessToken` (String, optional), `refreshToken` (String, optional), `accessTokenExpiresAt` (DateTime, optional), `refreshTokenExpiresAt` (DateTime, optional), `scope` (String, optional), `idToken` (String, optional), `password` (String, optional), `createdAt` (DateTime), `updatedAt` (DateTime)                                          | N to 1 `User`                        | Mapped to `account` table. Indexed on `userId`. Holds credential providers (email plus password) and OAuth tokens. Untouched by this spec.                                                                                   |
| **Verification (BetterAuth)** | `id` (String, `@id`), `identifier` (String), `value` (String), `expiresAt` (DateTime), `createdAt` (DateTime), `updatedAt` (DateTime)                                                                                                                                                                                                                                                                                                                                          | None                                 | Mapped to `verification` table. Indexed on `identifier`. Stores verification tokens and OTP values. Untouched by this spec.                                                                                                  |
| **StaySession**               | `id` (UUID, req), `stayId` (FK, req), `tokenHash` (String, req, unique), `expiresAt` (DateTime, checkout capped), `revoked` (Boolean, default `false`), `createdAt` (DateTime)                                                                                                                                                                                                                                                                                                  | N to 1 `Stay`                        | Managed by application stay auth. Token generated as random 32 bytes and stored as hash. One live row per stay. Live means not revoked plus not expired. History rows kept. Enforced by a partial unique index in migration. |

One live `StaySession` per stay replaces the prior strict unique `stayId` wording. The prior wording blocked a new mint after checkout unless the old row was deleted. The new wording keeps history and still guards the single device story from the rationale.

**State transitions**:

StaySession: ACTIVE to REVOKED (checkout, PIN lock, explicit sign out) or ACTIVE to EXPIRED (past expiresAt). Terminal states accept no further use; a new mint needs a correct PIN on an ACTIVE unlocked stay.

Staff: TEMPORARY to ACTIVE (forced password change at first sign in). Admin self demote and self disable are rejected transitions.

**How the feature works**:

1. Admin signs in, creates a staffer with name plus email plus role; the server sets a 16 char alphanumeric temporary password and sets `mustChangePassword` true plus `isDisabled` false. The temp secret shows once to the admin and is never logged. Seeded first admin uses `SEED_ADMIN_EMAIL` plus `SEED_ADMIN_PASSWORD` with `mustChangePassword` true; seed skips when the user already exists.
2. Staffer signs in with email plus password, is forced to set a real password (min 10 chars) through `POST /api/staff/me/password`, which clears `mustChangePassword`. Every staff screen and sensitive route gates on `mustChangePassword` plus `isDisabled` plus `lockedUntil`. Then staffer lands on the role home: desk to `/stays`, kitchen to `/kitchen`, admin to `/staff`. Unknown role returns to sign in.
3. Every staff request passes the edge gate (session plus role plus `isDisabled` plus `mustChangePassword`), sensitive routes recheck server side. Five wrong passwords set `lockedUntil` 15 min ahead. Success resets `failedSignInAttempts` to 0. Admin may clear the lock early. Locked requests get a generic message with no account detail. Sign in limits are 5 per account plus 20 per IP per 15 min in LRU, with 429 on limit. Postgres columns stay truth across restarts.
4. Guest enters the stay PIN; on match the server mints one StaySession row and sets the `stay_session` cookie (HTTP only, Secure, SameSite Lax, path root, cleared on revoke). Token is 32 random bytes base64url, stored as SHA256 `tokenHash`, looked up by hash with retry on collision. `expiresAt` equals checkout date at hotel noon local, max 30 days, no sliding. Second mint while one live row exists gets 409 with a reuse hint. One live row per stay keeps the single device story; sign out frees it for another device.
5. Later guest requests resolve the stay from the session row; wrong PIN counts toward the data model lockout.
6. Checkout or PIN lock revokes the stay session at once by setting `revoked` true; the next guest request asks for the PIN again. Desk plus admin may unlock a PIN locked stay through `POST /api/stays/[id]/unlock`, which resets `failedPinAttempts` and keeps the session revoked so the guest mints again with a correct PIN. Temp password reissue for staff is `POST /api/staff/reissue` by admin only.

**API surface**:

| Endpoint                 | Method | Key inputs                          | Key outputs            | Auth          | Key errors                                       |
| ------------------------ | ------ | ----------------------------------- | ---------------------- | ------------- | ------------------------------------------------ |
| /api/auth/\*             | \*     | BetterAuth owned                    | session cookie         | public        | 401 invalid credentials                          |
| /api/stay-session/mint   | POST   | stayId (req), pin 6 digits (req)    | stay cookie, expiresAt | LRU limit     | 401 wrong PIN, 403 locked stay, 409 session live |
| /api/stay-session/revoke | POST   | none (own cookie)                   | ok                     | stay session  | 401 no session                                   |
| /api/staff               | POST   | name (req), email (req), role (req) | user id, temp password | admin session | 403 non admin, 409 email taken, 422 weak role    |
| /api/staff/me/password   | POST   | current (req), next min 10 (req)    | ok, clears must change | staff session | 401 wrong current, 422 weak next                 |
| /api/staff/reissue       | POST   | userId (req)                        | new temp secret once   | admin session | 403 non admin, 404 unknown user                  |
| /api/stays/[id]/unlock   | POST   | stayId in path (req)                | ok, lock cleared       | desk or admin | 403 wrong role, 404 unknown stay                 |

**Value sourcing**:

| Action          | Value produced or displayed | Source                                                               |
| --------------- | --------------------------- | -------------------------------------------------------------------- |
| Sign in         | session plus role home      | `User.role` column via this spec                                     |
| Role gate       | allow or deny per screen    | `User.role` column plus the route map in this spec                   |
| Guest request   | stay identity               | `StaySession.stayId` row via this spec                               |
| Mint            | stay cookie plus expiry     | random token plus `Stay.checkOut` column, decided in spec 0002       |
| Lockout message | cooldown state              | `User.failedSignInAttempts` plus `lockedUntil` columns via this spec |
| PIN check       | match result                | input PIN hashed against `Stay.pinHash`, decided in spec 0002        |
| Temp password   | first secret                | server random 16 char alphanumeric, handed to admin once, never logged                    |
| Must change     | gate plus clear             | `User.mustChangePassword` set true on create and seed, cleared by `POST /api/staff/me/password` |
| Cooldown        | lock length plus reset      | `lockedUntil` 15 min ahead after 5 fails, reset on success, admin may clear early          |
| Stay expiry     | session end                 | `StaySession.expiresAt` from `Stay.checkOut` at hotel noon local, max 30 days, no sliding |
| Stay token      | secret shape                | 32 random bytes base64url, SHA256 `tokenHash`, lookup by hash                              |
| Stay cookie     | browser store               | name `stay_session`, HTTP only Secure SameSite Lax path root, cleared on revoke            |
| Role home       | landing screen              | desk to `/stays`, kitchen to `/kitchen`, admin to `/staff`, unknown to sign in            |
| Rate limit      | throttle values             | LRU 5 per account plus 20 per IP per 15 min, 429 on limit, Postgres stays truth           |
| Seed admin      | first login                 | `SEED_ADMIN_EMAIL` plus `SEED_ADMIN_PASSWORD` with must change true, skip when exists      |
| Unlock          | PIN restore                 | desk or admin `POST /api/stays/[id]/unlock`, resets PIN count, session stays revoked      |

**Key invariants**:

- Role comes only from the `User.role` column, written by admin only; client claims never decide access.
- Disabled users resolve to nobody; `isDisabled` true denies before any data read. An admin cannot demote or disable their own account.
- Must change users reach only sign in plus password change; all other screens deny until `mustChangePassword` is false.
- Five fails lock 15 min via `lockedUntil`; success resets the count; generic message while locked.
- At most one live stay session per stay; live means not revoked plus not expired; enforced by a partial unique index on `stayId` with that predicate; history rows kept; tokens stored hashed, never plain.
- Passwords and PINs and session tokens never logged.
- Expired or revoked sessions resolve to nobody; gates deny before any data read.
- An admin cannot demote or disable their own account.
- Stay session mint requires an ACTIVE unlocked stay covering today (stay validity decided in spec 0002). `expiresAt` derives from `Stay.checkOut` at hotel noon local, max 30 days.

**Security model**:

Staff reach screens by role: desk manages stays and guests at `/stays`, kitchen verifies and advances any order plus reads the board at `/kitchen`, admin does all plus menu at `/menu` plus staff management at `/staff`. Guests reach only their own stay rows through the stay session at guest routes. Wrong credentials get generic errors. Sign in plus mint endpoints share the LRU limiter (5 per account plus 20 per IP per 15 min, 429 on limit, Postgres stays truth). Stay cookie is `stay_session` with HTTP only Secure SameSite Lax. No compliance scope beyond staff emails plus guest names; no card data anywhere in this design.

**Configuration required**:

- `BETTER_AUTH_SECRET`: signs staff sessions (already in spec 0001, reused here).
- `BETTER_AUTH_URL`: public app URL (already in spec 0001, reused here).
- `SEED_ADMIN_EMAIL`: login for the seeded first admin (new, required to seed).
- `SEED_ADMIN_PASSWORD`: first secret for the seeded admin, rotated at first sign in (new, required to seed).

**Library permissions**:

Log for working agreement 1 (every outside download needs your prior approval):

- `better-auth` 1.7.x: already approved through spec 0001; this spec uses it, no new request.
- No new outside packages in this spec.

**Critical test scenarios**:

- Happy path: admin creates kitchen staff, staffer signs in and reaches the board, verifies **AC-1, AC-2**.
- Happy path: guest PIN mints one stay session resolving to the stay, verifies **AC-3**.
- Failure case: wrong password five times cools down, expired sessions redirect or re ask, verifies **AC-4, AC-5**.
- Failure case: checkout plus PIN lock revoke the session, checked out stay cannot mint, verifies **AC-6, AC-7**.
- Auth case: desk cannot verify, kitchen cannot manage staff, guest cannot reach staff surfaces, admin cannot self demote, verifies **AC-2, AC-8**.

## Build plan

Ordered by Tracer Bullet (thin thread first: staff sign in end to end, then guest session, then admin management).

1. Migration with BetterAuth tables plus `User.role` plus `failedSignInAttempts` plus `lockedUntil` plus `mustChangePassword` plus `isDisabled` plus `StaySession` with partial unique live index, satisfies **AC-2, AC-3, AC-5**.
2. BetterAuth server plus client wiring with email plus password and 12h cookie sessions, satisfies **AC-1**.
3. Staff sign in screen with generic errors plus forced temp password change, satisfies **AC-1, AC-8**.
4. Edge gates plus server rechecks for the three roles, satisfies **AC-2, AC-4**.
5. Stay session mint plus revoke endpoints on the stay cookie, satisfies **AC-3, AC-6, AC-7**.
6. Admin staff creation plus temp reissue plus seeded first admin plus self guard on demote and disable plus stay unlock by desk or admin, satisfies **AC-8, AC-2**.
7. LRU limits on sign in plus mint (5 per account plus 20 per IP per 15 min, 429) plus durable lockout columns, satisfies **AC-5**.
8. Prove with sign in per role plus mint plus revoke plus checkout walk, satisfies **AC-1 to AC-8**.

## Planned feature workflow

Plan, build with `/develop`, prove with `/check verify` (role screens gate, mint plus revoke walk passes, build passes), cover with `/test`, review with a fresh model `/check review`, note with `/document`. Spec status moves Proposed to In Progress to Accepted as the scope row moves. `/develop` updates this plan to match what was actually built.

## Consequences

**Positive**:

- One identity story for staff and guests that every later slice reuses instead of reinventing.
- Proven password plus session handling from BetterAuth instead of hand rolled secrets.
- Server side stay sessions revoke cleanly at checkout and lock, unlike sealed cookies.
- Edge gates plus server rechecks give defense in depth (two independent checkpoints).

**Negative / tradeoffs**:

- BetterAuth tables plus a custom session table mean two session systems to understand.
- One live stay session per stay blocks a second device until the first signs out.
- Forced password change adds a first run screen every staffer must pass.

**Neutral**:

- Guest PIN hashing stays in `lib/pin.ts` from spec 0002; this spec only calls it.
- PIN retry counting stays split LRU plus Postgres per spec 0001; staff lockout mirrors it.
- Socket room join rules stay with the realtime spec; this spec only supplies the sessions they check.
- Email sending is deferred; temp passwords travel out of band, no mail vendor now.

## Follow-up

- [ ] Realtime spec must define socket room join checks on top of these sessions.
- [ ] Slice 1 must build PIN entry UI calling the mint endpoint from task 5.
- [ ] Password reset by email waits for a mail vendor; temp password reissue by admin is the recovery path until then.
- [ ] BetterAuth plus auth area conventions are not yet in `AGENTS.md`. Owned by `/sync` or `/audit`; this skill does not edit context files.
- [ ] Library permission log per working agreement 1 lives in this spec under Feature design.
- [ ] Staff password hashing and account creation moved to spec 0006 (bcryptjs through the BetterAuth API seams); the direct write path described here no longer applies to credentials.

## Rationale

Reasoning and options: see rationale.md.
