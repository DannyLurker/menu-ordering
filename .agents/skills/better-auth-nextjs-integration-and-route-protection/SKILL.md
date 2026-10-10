---
name: better-auth-nextjs-integration-and-route-protection
description: Use when integrating Better Auth with Next.js App Router or Pages Router. Covers `toNextJsHandler`, auth route mounting, client setup, RSC and server action boundaries, proxy or middleware-based protection, and session checks across modern Next.js versions.
---

# Better Auth Next.js Integration And Route Protection

Use this skill when the Better Auth task is specifically about Next.js wiring.

## Scope

- App Router auth route setup
- Pages Router auth route setup
- `toNextJsHandler` and `toNodeHandler`
- Next.js client setup for Better Auth
- RSC and server action auth boundaries
- route protection with proxy or middleware
- cookie-based checks and session reads in Next.js

## Default path

1. Confirm whether the app is App Router or Pages Router.
2. Mount the Better Auth handler in `/api/auth/[...all]` unless the app has a strong reason to customize it.
3. Create the Better Auth client in a shared `lib/auth-client` boundary.
4. Use Better Auth session APIs where the framework runtime allows them.
5. For route protection, prefer the current Next.js runtime model:
   - `proxy.ts` for Next.js 16+
   - version-appropriate middleware or cookie checks for older releases
6. Keep auth checks close to the route boundary and avoid duplicating them inside every page.

## When to deviate

- Customize the auth route only when an existing app convention or deployment constraint requires it.
- Use Pages Router guidance only when the repo is actually Pages-based.
- Fall back to version-appropriate middleware naming or cookie checks when the app is on an older Next.js line.
- Move back to the Better Auth overview skill when the task is no longer specifically about Next.js wiring.

## Guardrails

- Do not mix App Router and Pages Router patterns in the same answer.
- Use the correct handler adapter for the route type.
- Keep auth route mounting and client base path aligned.
- Prefer cookie-based checks or Better Auth APIs over ad hoc session parsing.
- Next.js version differences matter; verify whether the app is on the proxy naming model.

## Avoid

- mixing App Router and Pages Router setup in one implementation path
- scattering auth checks through page components instead of keeping them near route boundaries
- hand-parsing session cookies when Better Auth or framework APIs already own that surface
- ignoring the Next.js version when recommending `proxy.ts` vs older middleware patterns

## Verification checklist

- router type is confirmed as App Router or Pages Router
- handler adapter and file location match the router type
- auth route and client base path stay aligned
- route protection lives at a deliberate boundary
- Next.js version-specific guidance is correct for the target app

## Common Routing Cues

- Next.js Better Auth, `toNextJsHandler`, `toNodeHandler`, `/api/auth/[...all]`, App Router, Pages Router, proxy.ts, middleware, protected dashboard, server action auth

## Output Shape

When answering with this skill, prefer:

- route file location
- exact adapter choice
- client file location
- route-protection boundary
- version-specific Next.js note when required

## Official References

- https://better-auth.com/docs/installation
- https://better-auth.com/docs/integrations/next
- https://better-auth.com/docs/basic-usage
- https://better-auth.com/docs/concepts/api

## Current snapshot

- Checked against official docs on 2026-04-03
- Current npm line verified live on 2026-04-03: `better-auth@1.5.6`
- Next.js integration docs in scope: installation, Next integration, basic usage, and API concepts
