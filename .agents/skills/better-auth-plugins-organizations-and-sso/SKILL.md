---
name: better-auth-plugins-organizations-and-sso
description: Use when extending Better Auth with plugins, especially organization management and enterprise SSO. Covers plugin wiring on server and client, CLI migration flow, organization roles and access control, and deciding when SSO or organization plugins belong in the auth design.
---

# Better Auth Plugins Organizations And SSO

Use this skill when Better Auth work goes beyond core email or social auth and into plugin-driven features.

## Scope

- plugin installation and registration
- `npx @better-auth/cli migrate` and `generate`
- client plugin wiring
- organization plugin setup
- organization roles, permissions, and active org handling
- SSO plugin setup and enterprise identity boundaries

## Default path

1. Identify which plugin surface the app actually needs before enabling more than one plugin.
2. Add the plugin to the server config first.
3. Run migration or schema generation before using plugin-backed features.
4. Add the matching client plugin when the feature has client-side methods.
5. For organizations, define creation rules, active organization behavior, and role or permission model early.
6. For SSO, define the identity-provider type, callback destination, and tenant or org ownership before implementation.

## When to deviate

- Add more than one plugin only when the product really needs both surfaces.
- Skip client plugin wiring when the feature is entirely server-owned.
- Move to the overview or social skills when the task is still deciding between baseline auth modes rather than plugin-backed capabilities.
- Treat organization and SSO setup as product-contract work, not just package wiring, whenever roles or tenancy are involved.

## Guardrails

- Do not enable plugins speculatively just because they exist.
- Keep server plugin registration and client plugin registration in sync.
- Treat organization roles and permissions as product contracts, not UI-only labels.
- In SSO setups, keep the callback destination distinct from the provider callback route itself.
- Validate org or enterprise identity assumptions before layering in access control.

## Avoid

- enabling plugins “for later” without a product use case
- forgetting the migration or schema generation step before using plugin-backed data
- treating org roles as loose UI labels instead of access-control contracts
- blurring provider callback routes with post-login app destinations in SSO flows

## Verification checklist

- only required plugins are enabled
- server plugin wiring and client plugin wiring stay aligned
- migrations or generation steps are included before feature usage
- organization roles or SSO ownership rules are explicit
- access-control assumptions are validated instead of implied

## Common Routing Cues

- Better Auth plugins, organization plugin, roles, permissions, `organizationClient`, active organization, `@better-auth/sso`, SSO, OIDC, SAML, enterprise auth

## Output Shape

When answering with this skill, prefer:

- plugin package and config shape
- migration step
- client plugin requirement
- org or SSO ownership decision
- access-control boundary

## Official References

- https://better-auth.com/docs/basic-usage
- https://better-auth.com/docs/plugins/organization
- https://better-auth.com/docs/plugins/sso
- https://better-auth.com/docs/concepts/client

## Current snapshot

- Checked against official docs on 2026-04-03
- Current npm line verified live on 2026-04-03: `better-auth@1.5.6`
- Plugin docs in scope: basic usage, organization plugin, SSO plugin, and client concepts
