---
name: better-auth-overview-and-setup
description: Use when setting up Better Auth for the first time or routing Better Auth work to the right follow-up skill. Covers package installation, secrets, base URL, auth handler mounting, client creation, and plugin-aware setup decisions.
---

# Better Auth Overview And Setup

Use this skill for first-time Better Auth setup and top-level architecture choices.

## Scope

- installing `better-auth`
- configuring `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`
- mounting the auth handler in the target framework
- creating the auth client
- choosing between email/password, social auth, or plugins
- deciding when a task belongs to sessions, OAuth, Next.js, or plugin-specific work

## Default path

1. Install `better-auth` in the server boundary and client boundary if they are separate.
2. Configure a high-entropy `BETTER_AUTH_SECRET` and the correct app base URL.
3. Create the server auth instance with `betterAuth(...)`.
4. Mount the handler at the framework's auth route.
5. Create the client with `createAuthClient(...)` and the right `baseURL` or `basePath`.
6. Turn on only the auth methods the app actually needs.
7. If the task introduces plugins, plan for both server plugin wiring and client plugin wiring.

## When to deviate

- Customize the auth route only if the host framework or an existing app convention truly requires it.
- Move to the Next.js skill when the work is mostly route protection or App Router integration.
- Move to the social or plugin skills when the task introduces providers, organizations, SSO, or plugin-specific contracts.
- Treat dynamic base URL handling as required when previews, multi-domain setups, or changing origins are in play.

## Guardrails

- Keep secrets server-only.
- Do not guess the deployed base URL when previews or custom domains are involved.
- Keep the auth route stable unless there is a strong reason to customize it.
- Treat Better Auth as the auth boundary for sessions and provider callbacks instead of hand-rolling adjacent routes.
- Use the official client package for the target environment (`client`, `react`, etc.) when hooks or reactive helpers are needed.

## Common Routing Cues

- Better Auth installation, `betterAuth`, `createAuthClient`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, auth route setup, base URL, base path, auth handler

## Avoid

- hand-rolling provider callback routes or session routes outside Better Auth
- exposing secrets or provider credentials to the client
- enabling auth methods “just in case” instead of choosing the ones the app actually needs
- hardcoding a production base URL when the app has preview or multi-domain environments

## Verification checklist

- `BETTER_AUTH_SECRET` is high-entropy and server-only
- `BETTER_AUTH_URL` or dynamic base URL handling matches the deployment model
- the auth handler route is mounted and stable
- the client is created with the correct base URL or base path
- follow-up work is routed to sessions, social auth, Next.js, or plugin skills when the setup step is complete

## Output Shape

When answering with this skill, prefer:

- required packages
- required env vars
- auth server file shape
- auth client file shape
- which follow-up Better Auth skill owns the next step

## Official References

- https://better-auth.com/docs/installation
- https://better-auth.com/docs/basic-usage
- https://better-auth.com/docs/concepts/client
- https://better-auth.com/docs/concepts/dynamic-base-url

## Current snapshot

- Checked against official docs on 2026-04-03
- Current npm line verified live on 2026-04-03: `better-auth@1.5.6`
- Core setup docs in scope: installation, basic usage, client concepts, and dynamic base URL
