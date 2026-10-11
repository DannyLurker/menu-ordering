# Auth and Roles — How It Wires Up

Stack: `better-auth@1.7.7` + Prisma Postgres adapter + `bcryptjs` + `nextCookies()`. No NextAuth, no custom `useSession` hook, no Server Actions for auth.

## 1. Core files

| What             | Where                                                                        |
| ---------------- | ---------------------------------------------------------------------------- |
| Auth instance    | `lib/auth.ts:26-62`                                                          |
| Prisma roles     | `prisma/schema.prisma:43-66` (`StaffRole`: `FRONT_DESK`, `KITCHEN`, `ADMIN`) |
| Role vocab       | `features/staff/staff.types.ts:4-16`                                         |
| Server gates     | `features/staff/staff.auth.ts:47-89`                                         |
| Edge gate        | `proxy.ts:58-123` (note: `proxy.ts`, not `middleware.ts`)                    |
| Browser client   | `features/staff/staff.auth-client.ts:8-10`                                   |
| Account service  | `features/staff/services/staff.service.ts`                                   |
| Public re-export | `features/staff/index.ts:6-45`                                               |

Config highlights (`lib/auth.ts`):

- `emailAndPassword` enabled, `disableSignUp: true` — staff are created by admins only via `POST /api/staff`.
- Passwords: bcrypt cost 10, single hash/verify authority (`STAFF_PASSWORD_COST`).
- Session: 12h expiry (`STAFF_SESSION_HOURS`), `updateAge` 6h, `cookieCache` disabled — identity is read per-request via headers.
- Extra user fields: `role`, `failedSignInAttempts`, `lockedUntil`, `mustChangePassword`, `isDisabled` (all `input: false`, never client-settable).

Env (see `.env.example:1-7`): `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`.

## 2. Server gates — always use these

`features/staff/staff.auth.ts` is the only place that trusts `User.role` from the DB. Never trust a client-sent role.

```ts
import {
  getStaffUser,
  getStaffUserWithFlags,
  requireStaffRole,
} from "@/features/staff";

// Pages / layouts: null when signed out, disabled, or locked.
const user = await getStaffUser();
if (!user) redirect("/sign-in");
if (user.mustChangePassword) redirect("/change-password");
if (user.role !== "ADMIN") redirect("/stays"); // per-page allow-list

// API routes: full gate (401 / 403 MUST_CHANGE_PASSWORD / 403 FORBIDDEN).
export async function GET() {
  const gate = await requireStaffRole(["ADMIN"]);
  if ("response" in gate) return gate.response;
  const { user } = gate;
  // ... use user.id / user.role
}
```

- `getStaffUser()` — drops `mustChangePassword` detail; use for page redirects.
- `getStaffUserWithFlags()` — keeps flags; use when you need to distinguish `401` vs `403 MUST_CHANGE_PASSWORD` (e.g. `app/api/staff/me/route.ts:7-12`, password change route).
- `requireStaffRole(roles)` — returns `{ user } | { response }`. Call it first in every sensitive route handler.

Existing patterns: `app/api/staff/route.ts:18,27` (`ADMIN` only), `app/api/stays/[id]/unlock/route.ts:12` (`FRONT_DESK`+`ADMIN`), `app/stays/page.tsx:13-19`, `app/kitchen/page.tsx:13-18`, `app/staff/page.tsx:13`.

## 3. Edge gate (`proxy.ts`)

Runs before pages/APIs. Reads `auth.api.getSession({ headers: request.headers })`, derives `{ role, mustChangePassword, isDisabled, locked }` (`proxy.ts:20-37`).

Route table (`proxy.ts:50-56`, `82-117`):

| Path                                                  | Allowed                     |
| ----------------------------------------------------- | --------------------------- |
| `/api/auth/*`, `/api/stay-session/*`                  | public (own their limits)   |
| `/api/staff`, `/api/staff/reissue`, `/api/staff/[id]` | `ADMIN`                     |
| `/api/staff/me*`                                      | any signed-in staff         |
| `/api/stays/*`                                        | `FRONT_DESK`, `ADMIN`       |
| `/stays`                                              | `FRONT_DESK`, `ADMIN`       |
| `/kitchen`                                            | `KITCHEN`, `ADMIN`          |
| `/staff`, `/menu`                                     | `ADMIN`                     |
| `/`, `/sign-in`                                       | role → `ROLE_HOME` redirect |

`ROLE_HOME` (`staff.types.ts:8-12`): `FRONT_DESK → /stays`, `KITCHEN → /kitchen`, `ADMIN → /staff`. `mustChangePassword` users are forced to `/change-password` (API callers get `403 MUST_CHANGE_PASSWORD` instead).

Edge is a fast deny only — route handlers must still call `requireStaffRole` / `getStaffUser`.

## 4. Browser usage

```ts
// features/staff/staff.auth-client.ts
import { createAuthClient } from "better-auth/react";
export const authClient = createAuthClient({ baseURL: window.location.origin });
```

- Sign in (`app/sign-in/page.tsx:40-59`): `await authClient.signIn.email({ email, password })`, then `fetch("/api/staff/me")` to learn the role, then `router.push(ROLE_HOME[role])`.
- Sign out (`components/ui/sign-out-button.tsx:14-21`): `await authClient.signOut(); router.push("/sign-in")`.
- Change password (`app/change-password/page.tsx:35-39`): `fetch("/api/staff/me/password", { method: "POST", body: JSON.stringify({ current, next }) })`.

Pages are server components; there is no `useStaff` / `useRole` hook.

## 5. Account service (`features/staff/services/staff.service.ts`)

- `createStaffAccount(db, { name, email, role })` — validates via `staff.schemas.ts`, writes through `auth.$context.internalAdapter`, returns temp password from `generateTempPassword(16)`.
- `reissueTempPassword`, `changeStaffPassword`, `listStaffAccounts`, `updateStaffAccount`, `toStaffPublic`.
- Lockout: `checkSignInAllowed / recordSignInFailure / recordSignInSuccess` — 5 bad attempts → `lockedUntil` +15 min. Wired in `app/api/auth/[...all]/route.ts:30-84` with generic error copy (no account enumeration).

## 6. How to add …

- **New protected API route:** call `requireStaffRole([...])` first, then your logic. Add the prefix to `apiRole()` in `proxy.ts:50-56` if it needs edge enforcement.
- **New protected page:** `getStaffUser()` + `redirect("/sign-in")` + `mustChangePassword` check + role allow-list check. Keep `export const dynamic` / per-request behavior so headers-based identity is fresh.
- **New role:** add to `StaffRole` enum in `prisma/schema.prisma` + migration, to `STAFF_ROLES` / `ROLE_HOME` in `staff.types.ts`, to `roleOf` in `proxy.ts:9-11` and `server.ts:47-51`, and to every `requireStaffRole` allow-list.

## 7. Verify

- `pnpm vitest run lib/auth.test.ts features/staff/staff.auth.test.ts`
- `pnpm tsx scripts/prove-auth-and-roles.ts`
- Spec: `docs/specs/0004-auth-and-roles/index.md`
