# Review, master, 2026-10-11 (auth and roles)

**Reviewed by**: Muse Spark (author on Muse Spark, same model, degraded review, blind spots shared)
**Scope**: 18 files, uncommitted (feature 4, auth and roles; PIN hashing and staff password seams reviewed separately)
**Verdict**: Approve with nits

## Summary

The auth layer reads correctly throughout: edge gates fail closed, every sensitive route rechecks server side, error messages stay generic, and no client claim ever decides access. The two minors below are a swallowed database error behind a 409 and a second password change path that bypasses the must change flag clearing. No correctness or security holes found.

## Minor
### 🟡 Database failure masked as session conflict, `features/stay-session/services/stay-session-service.ts`
**Problem**: the `createStaySessionRow` try/catch maps every failure to 409 SESSION_LIVE. A dead connection or constraint fault therefore answers "already signed in on another device" and the real error never reaches any log.
**Why it matters**: fail closed is right, but silent misdiagnosis sends the next debugger after device state instead of the database.
**Suggested fix**: log the caught error server side before returning the 409.

### 🟡 Native password change path skips the must change clearing, `app/api/auth/[...all]/route.ts`
**Problem**: BetterAuth still mounts its own change password endpoint, and it rotates the secret without clearing `mustChangePassword`. A staffer who finds it stays gated on every screen until they repeat the change through the custom endpoint.
**Why it matters**: two paths with different side effects, one of them a dead end the user cannot see.
**Suggested fix**: either block the native endpoint for must change users or document the custom endpoint as the only supported path.

## Nits
- ⚪ `proxy.ts:6`, duplicate import from the same module; merge into one line.
- ⚪ `app/api/stay-session/mint/route.ts:45`, `if (stayId)` guard is dead since the schema requires a non empty stay id.

## Strengths
- Every gate denies before any data read, at the edge and again in the route, with unknown roles and expired sessions falling back to sign in.
- Wrong credentials answer generic everywhere: sign in, mint, and lockout messages name neither the account nor the field.
- Stay cookie is HTTP only with SameSite Lax and Secure in production, and the token never appears in a response body.
- No ownership bugs available: the password route acts on the session user with no target id taken from the client.

## Test coverage
Covered: staff gates with mocked session boundary, request schemas, rate limiter budgets plus reset, staff service behaviours against live rows, PIN hashing plus upgrade, full flows over HTTP in the prove walk. Uncovered: visual rendering of the sign in and change password screens (HTTP copy and gate checks observed instead); native change password path behaviour (minor above).
