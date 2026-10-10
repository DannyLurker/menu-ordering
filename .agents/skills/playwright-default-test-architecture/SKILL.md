---
name: playwright-default-test-architecture
description: Choose a stable Playwright test architecture before writing more tests. Use when tasks mention Playwright adoption, test folder layout, fixture boundaries, `playwright.config.ts`, projects, retries, parallelism, CI posture, browser coverage, or deciding which Playwright follow-up skill should own the work.
---

# Playwright Default Test Architecture

Use this skill when the task is about the overall Playwright testing shape, not one isolated selector or one-off assertion.

## Scope

- test architecture and ownership
- `playwright.config.ts` defaults
- fixture boundaries
- browser and project strategy
- retry and parallelism posture
- routing to deeper Playwright skills

## Routing cues

- adopt Playwright, structure a test suite, define projects, configure retries, choose fixture boundaries, or decide where a Playwright task belongs -> use this skill
- locators, assertions, actionability, or user-visible test contracts -> use `playwright-locators-assertions-and-user-visible-contracts`
- auth reuse, storage state, multi-role projects, or isolation boundaries -> use `playwright-auth-projects-and-isolation`
- route interception, API synchronization, request waiting, or mocking strategy -> use `playwright-network-control-and-api-synchronization`
- flakes, traces, codegen, debug mode, inspector, or trace viewer -> use `playwright-debugging-traces-and-flake-reduction`

## Default path

1. Keep one `playwright.config.ts` as the suite contract.
2. Organize tests by product surface or user journey, not by Playwright API method.
3. Start with a small number of projects and add browser or device expansion only when there is real coverage value.
4. Keep shared setup in fixtures and helper functions, not in ad hoc before-each sprawl.
5. Prefer deterministic environment setup over compensating with retries.
6. Treat retries as CI resilience, not as the primary flake fix.

## When to deviate

- Split config or projects more aggressively only when the app truly has distinct runtime surfaces.
- Use more retries in CI only when infrastructure noise is real and understood.
- Add device or browser matrix breadth only when the product surface justifies the cost.

## Guardrails

- tests should model user-visible behavior, not internal implementation details
- config should stay small and legible
- fixtures should centralize setup, not hide business logic
- retries should never be the first answer to instability
- browser coverage should reflect product risk, not default maximalism

## Avoid

- creating many projects before the team knows why each one exists
- hiding essential test behavior in over-abstracted fixtures
- treating retries as a substitute for synchronization discipline
- organizing tests around framework internals instead of real product flows

## Verification checklist

- config is small and explicit
- tests are grouped by product behavior or journeys
- fixture boundaries reduce duplication without obscuring meaning
- project count matches actual coverage needs
- retries are deliberate and limited

## Current snapshot

- Checked against official docs on 2026-04-03
- Current npm lines verified live on 2026-04-03: `playwright@1.59.1`, `@playwright/test@1.59.1`
- Docs in scope: configuration, best practices, fixtures, and projects

## Official references

- https://playwright.dev/docs/intro
- https://playwright.dev/docs/test-configuration
- https://playwright.dev/docs/test-projects
- https://playwright.dev/docs/test-fixtures
- https://playwright.dev/docs/best-practices

## References

- [Architecture defaults](./references/architecture-defaults.md)
