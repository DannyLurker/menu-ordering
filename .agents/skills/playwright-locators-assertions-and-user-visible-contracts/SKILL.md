---
name: playwright-locators-assertions-and-user-visible-contracts
description: Use when writing or fixing Playwright tests that should stay stable against UI refactors. Covers locators, actionability, web-first assertions, accessible roles, text and label contracts, and the rule that tests should bind to user-visible semantics before DOM structure.
---

# Playwright Locators Assertions And User Visible Contracts

Use this skill when test fragility is mostly about how the test finds things and what it asserts.

## Scope

- locator strategy
- web-first assertions
- actionability expectations
- accessible roles, labels, and visible text
- stable contracts for end-to-end tests

## Routing cues

- locator choice, flaky selectors, `getByRole`, `getByLabel`, `locator()`, text assertions, `expect(locator)`, actionability, auto-waiting, or stable UI contracts -> use this skill
- suite architecture, fixtures, or config shape -> use `playwright-default-test-architecture`
- auth setup or storage state reuse -> use `playwright-auth-projects-and-isolation`
- network mocking or request synchronization -> use `playwright-network-control-and-api-synchronization`
- trace-based debugging or codegen cleanup -> use `playwright-debugging-traces-and-flake-reduction`

## Default path

1. Use user-visible locators first: role, label, placeholder, text, alt text, or title.
2. Prefer `expect(locator)` web-first assertions over manual polling or arbitrary waits.
3. Let Playwright actionability checks do their job before adding more synchronization.
4. Use test IDs only where user-visible semantics are genuinely unstable or absent.
5. Assert meaningful UI outcomes, not incidental DOM structure.

## When to deviate

- Use test IDs when the surface is intentionally non-semantic or the text is too unstable.
- Use lower-level CSS or DOM selectors only for targeted edge cases where semantic contracts are impossible.
- Use text assertions narrowly when the product copy is part of the contract, not when content churn is expected.

## Guardrails

- accessible roles and labels are the preferred contract
- assertions should wait on the UI state you actually care about
- test IDs are a fallback, not the default locator system
- one stable locator is better than several chained brittle ones

## Avoid

- brittle CSS selectors tied to nesting or styling classes
- `waitForTimeout` as synchronization
- asserting implementation details like hidden wrappers or internal DOM counts
- mixing several locator strategies in one test without a reason

## Verification checklist

- the primary locators match user-visible semantics where possible
- assertions use Playwright's web-first model
- no arbitrary timeout is carrying the test
- any test IDs are intentional and limited
- the test would survive a presentational refactor that keeps behavior intact

## Quick example

```ts
await page.getByRole("button", { name: "Save" }).click();
await expect(page.getByRole("status")).toHaveText("Saved");
```

## Current snapshot

- Checked against official docs on 2026-04-03
- Current npm line verified live on 2026-04-03: `@playwright/test@1.59.1`
- Docs in scope: locators, actionability, auto-waiting, and assertions

## Official references

- https://playwright.dev/docs/locators
- https://playwright.dev/docs/actionability
- https://playwright.dev/docs/auto-waiting
- https://playwright.dev/docs/test-assertions

## References

- [Locator and assertion defaults](./references/locator-and-assertion-defaults.md)
