---
name: playwright-auth-projects-and-isolation
description: Use when reusing authenticated state or modeling multiple user roles in Playwright without leaking state between tests. Covers storage state, setup projects, browser contexts, role-based projects, and the rule that isolation should stay intact even when login is optimized away.
---

# Playwright Auth Projects And Isolation

Use this skill when the hard part is authenticated reuse or role-based test setup, not generic UI interaction.

## Scope

- authentication setup projects
- storage state reuse
- role-based projects
- browser context isolation
- keeping login optimization compatible with test independence

## Routing cues

- Playwright auth, login reuse, `storageState`, setup project, multiple roles, admin vs user tests, browser contexts, or test isolation -> use this skill
- locator and assertion problems -> use `playwright-locators-assertions-and-user-visible-contracts`
- suite topology or retry posture -> use `playwright-default-test-architecture`
- route mocking or API synchronization -> use `playwright-network-control-and-api-synchronization`

## Default path

1. Keep each test isolated in its own browser context.
2. Reuse authentication through a dedicated setup project that writes storage state.
3. Create distinct storage states for materially different roles.
4. Keep login helpers deterministic and small.
5. Refresh or rebuild auth state when it becomes stale instead of stacking hidden recovery logic into tests.

## When to deviate

- Log in within the test only when the login flow itself is the subject under test.
- Use API-level auth seeding only when it is stable, intentional, and still represents a valid user state for the UI.
- Collapse role projects only when their effective permissions and UI are truly the same.

## Guardrails

- keep isolation even when auth is reused
- treat role boundaries as product contracts, not just config names
- storage state is a performance optimization, not permission logic
- setup projects should prepare auth state, not quietly perform unrelated product setup

## Avoid

- sharing one mutable logged-in state across unrelated tests
- testing login in every test when the flow itself is not under test
- baking large business setup into auth bootstrap helpers
- assuming two roles can share one state file because they both can log in

## Verification checklist

- tests still run in isolated browser contexts
- auth reuse is driven by setup projects or a similarly explicit mechanism
- distinct roles have distinct state when their permissions differ
- login flow tests exist separately when login is a product surface
- auth bootstrap is small enough to debug when it breaks

## Current snapshot

- Checked against official docs on 2026-04-03
- Current npm line verified live on 2026-04-03: `@playwright/test@1.59.1`
- Docs in scope: authentication, projects, and browser context isolation

## Official references

- https://playwright.dev/docs/auth
- https://playwright.dev/docs/test-projects
- https://playwright.dev/docs/browser-contexts

## References

- [Auth and isolation defaults](./references/auth-and-isolation-defaults.md)
