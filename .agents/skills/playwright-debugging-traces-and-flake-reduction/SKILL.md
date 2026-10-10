---
name: playwright-debugging-traces-and-flake-reduction
description: Use when a Playwright test is flaky, failing only in CI, or needs investigation rather than another retry. Covers traces, inspector, UI mode, codegen cleanup, and turning intermittent failures into concrete synchronization or contract fixes.
---

# Playwright Debugging Traces And Flake Reduction

Use this skill when the problem is unreliable test behavior or poor observability during failure analysis.

## Scope

- trace viewer
- inspector and UI mode
- codegen as a debugging aid
- CI-only flake investigation
- turning failures into explicit synchronization or contract fixes

## Routing cues

- flaky tests, CI-only failures, trace viewer, `show-trace`, UI mode, inspector, `PWDEBUG`, codegen, or finding the real source of instability -> use this skill
- if the issue is clearly just a bad locator or weak assertion -> use `playwright-locators-assertions-and-user-visible-contracts`
- if the issue is clearly auth reuse or stale storage state -> use `playwright-auth-projects-and-isolation`
- if the issue is clearly backend timing or mocking boundaries -> use `playwright-network-control-and-api-synchronization`

## Default path

1. Reproduce the failure with traces enabled.
2. Inspect the failing step in Trace Viewer before changing the test.
3. Use UI mode or inspector when an interactive run clarifies the timing or locator issue.
4. Use codegen only to discover robust locators or interaction flow, then clean the generated code aggressively.
5. Fix the root contract: locator, assertion, synchronization, auth state, or environment setup.

## When to deviate

- Increase trace capture only when the existing signal is insufficient.
- Use video or screenshot artifacts when traces alone do not explain a visual issue.
- Add targeted debug logging only when the trace and inspector still leave the failure ambiguous.

## Guardrails

- investigate before changing retries
- codegen output is raw material, not final test code
- flake fixes should remove ambiguity, not just slow the test down
- CI-only failures usually mean environment or synchronization drift, not just “bad luck”

## Avoid

- bumping retries first and calling the flake solved
- committing codegen output unchanged
- adding blanket waits because the trace was not inspected
- treating one passing rerun as proof the test is healthy

## Verification checklist

- traces or equivalent artifacts were inspected before the fix
- the final change addresses a concrete source of instability
- retries were not the primary fix
- generated debug code was cleaned up or discarded
- the test is easier to reason about after the change

## Current snapshot

- Checked against official docs on 2026-04-03
- Current npm line verified live on 2026-04-03: `@playwright/test@1.59.1`
- Docs in scope: debugging, trace viewer, codegen, and test running

## Official references

- https://playwright.dev/docs/debug
- https://playwright.dev/docs/trace-viewer
- https://playwright.dev/docs/codegen
- https://playwright.dev/docs/running-tests

## References

- [Flake investigation defaults](./references/flake-investigation-defaults.md)
