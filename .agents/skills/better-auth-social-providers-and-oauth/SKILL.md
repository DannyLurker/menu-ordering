---
name: better-auth-social-providers-and-oauth
description: Use when configuring social sign-in or provider-based OAuth flows in Better Auth. Covers social provider config, signIn.social, account linking, provider access tokens, generic OAuth, custom scopes, profile mapping, and redirect handling.
---

# Better Auth Social Providers And OAuth

Use this skill when Better Auth is handling provider login instead of local credentials.

## Scope

- social provider configuration
- provider credentials and redirect wiring
- `signIn.social`
- linking provider accounts
- retrieving or refreshing provider access tokens
- generic OAuth for unsupported providers
- scope and profile mapping choices

## Default path

1. Configure the provider in `socialProviders` with the right client credentials.
2. Keep provider credentials server-only.
3. Use `signIn.social` on the client for browser login flows unless a server-side initiation is required.
4. Decide whether users can link additional providers after initial account creation.
5. If the app needs provider APIs later, plan around `getAccessToken` and refresh behavior.
6. For unsupported providers, move to the Generic OAuth plugin instead of hacking custom callback flows outside Better Auth.

## When to deviate

- Use a server-side initiation path only when the app boundary or provider flow requires it.
- Request additional scopes only when a concrete downstream provider API needs them.
- Move to the Generic OAuth plugin when the provider is unsupported rather than hacking callback plumbing yourself.
- Route to the plugin skill when OAuth work becomes mainly about proxying, org ownership, or enterprise identity patterns.

## Guardrails

- Do not hand-roll provider callback routes that Better Auth already manages.
- Do not expose provider secrets to the client.
- Treat scopes as least-privilege, not “request everything.”
- Do not assume an access token will stay valid forever; Better Auth can refresh it when available.
- Keep account-linking behavior explicit to avoid accidental identity merges.

## Avoid

- hand-rolling provider callback routes outside Better Auth
- requesting broad provider scopes without a defined product need
- assuming long-lived provider tokens without planning refresh behavior
- making account linking implicit and risking accidental identity merges

## Verification checklist

- provider credentials stay server-only
- login flow uses `signIn.social` or a justified server-side initiation path
- requested scopes are least-privilege
- token refresh or downstream provider API behavior is considered when needed
- account-linking rules are explicit

## Common Routing Cues

- socialProviders, Google auth, GitHub auth, `signIn.social`, link social account, provider scopes, generic OAuth, access token refresh, provider profile mapping

## Output Shape

When answering with this skill, prefer:

- provider config shape
- client auth call
- token or account-linking decision
- when to use Generic OAuth

## Official References

- https://better-auth.com/docs/concepts/oauth
- https://better-auth.com/docs/authentication/other-social-providers
- https://better-auth.com/docs/plugins/oauth-proxy

## Current snapshot

- Checked against official docs on 2026-04-03
- Current npm line verified live on 2026-04-03: `better-auth@1.5.6`
- OAuth docs in scope: OAuth concepts, other social providers, and OAuth proxy plugin
