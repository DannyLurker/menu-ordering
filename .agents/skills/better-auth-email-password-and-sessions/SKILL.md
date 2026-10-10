---
name: better-auth-email-password-and-sessions
description: Use when implementing email and password auth or tuning session behavior in Better Auth. Covers sign-up and sign-in flows, password reset boundaries, cookie-backed sessions, refresh policy, cache strategy, stateless mode, and session-sensitive security tradeoffs.
---

# Better Auth Email Password And Sessions

Use this skill when the app relies on Better Auth's built-in account auth and session model.

## Scope

- enabling `emailAndPassword`
- sign-up and sign-in flows
- password reset boundaries
- auto sign-in behavior after registration
- session expiration and refresh policy
- cookie cache strategy and revocation tradeoffs
- stateless or secondary-storage session design

## Default path

1. Enable `emailAndPassword` only if the product actually needs password auth.
2. Decide whether sign-up should auto sign in or require a separate step.
3. Use client methods for browser-side auth actions and `auth.api` only on the server.
4. Set session expiration and `updateAge` intentionally instead of accepting defaults blindly.
5. Choose whether cookie cache should be enabled based on revocation sensitivity and performance needs.
6. If using secondary storage or stateless mode, define how session invalidation will work before rollout.

## When to deviate

- Skip password auth entirely when the product only needs social or enterprise identity.
- Keep cookie cache off when immediate revocation matters more than read performance.
- Use stateless or secondary-storage sessions only when the deployment model or scale constraints justify the extra invalidation complexity.
- Move to the social or Next.js skills when those surfaces, not session policy, become the dominant concern.

## Guardrails

- Do not call Better Auth client methods from the server.
- Do not enable cookie cache without understanding the delayed-revocation tradeoff.
- Keep password reset and secret-token flows server-controlled.
- Use secure cookie defaults and short cache windows for sensitive applications.
- If immediate revocation matters, prefer database-backed validation or a shorter cookie-cache lifetime.

## Avoid

- enabling password auth by default without product need
- mixing browser client calls with server-only auth APIs
- turning on cookie cache just for speed without handling revocation risk
- choosing stateless sessions before deciding how revocation and invalidation will work

## Verification checklist

- password auth is enabled only if the product really needs it
- browser-side auth calls stay in the client boundary
- session expiration and refresh policy are explicit
- cookie cache policy matches revocation sensitivity
- reset and token flows remain server-controlled

## Common Routing Cues

- emailAndPassword, signUp.email, signIn.email, requestPasswordReset, session expiration, cookie cache, stateless sessions, `getSession`, `useSession`

## Output Shape

When answering with this skill, prefer:

- auth config change
- client call shape
- session policy decision
- revocation or refresh tradeoff
- what stays server-only

## Official References

- https://better-auth.com/docs/basic-usage
- https://better-auth.com/docs/authentication/email-password
- https://better-auth.com/docs/concepts/session-management
- https://better-auth.com/docs/concepts/client

## Current snapshot

- Checked against official docs on 2026-04-03
- Current npm line verified live on 2026-04-03: `better-auth@1.5.6`
- Session docs in scope: basic usage, email-password auth, session management, and client concepts
