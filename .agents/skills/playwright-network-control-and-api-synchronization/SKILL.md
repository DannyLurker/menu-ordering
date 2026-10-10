---
name: playwright-network-control-and-api-synchronization
description: Use when Playwright tests need stable synchronization with backend behavior or deliberate network control. Covers request waiting, route interception, mocking boundaries, API request contexts, and the rule that tests should not over-mock what they actually need to verify.
---

# Playwright Network Control And API Synchronization

Use this skill when the test problem is really about backend timing, request control, or mocking boundaries.

## Scope

- waiting on meaningful network activity
- route interception and mocking
- API request contexts
- backend synchronization
- deciding what should be mocked vs exercised end to end

## Routing cues

- `page.route`, request interception, API mocking, `waitForResponse`, `APIRequestContext`, backend synchronization, flaky loading due to network timing, or when to mock -> use this skill
- locator or assertion fragility -> use `playwright-locators-assertions-and-user-visible-contracts`
- auth state and role reuse -> use `playwright-auth-projects-and-isolation`
- traces, flaky failure analysis, or codegen cleanup -> use `playwright-debugging-traces-and-flake-reduction`

## Default path

1. Prefer real backend flows for the core happy path when they are stable and meaningful to the product.
2. Synchronize on visible outcomes first, and on targeted network events second when the UI alone is not enough.
3. Mock only the dependencies that make the test too slow, too flaky, or too hard to control.
4. Keep mocks narrow and scenario-specific.
5. Use API request contexts for setup and teardown when that keeps UI tests focused on the right surface.

## When to deviate

- Mock more aggressively only when third-party dependencies or rare failure branches are the real subject.
- Wait on network events directly only when the visible UI signal is too indirect or ambiguous.
- Use fully mocked flows for deterministic edge-case coverage that would be impractical end to end.

## Guardrails

- do not over-mock the product's own critical behavior
- network waits should correspond to a meaningful contract
- setup via API is fine when it removes irrelevant UI churn
- mocks should remain readable and local to the scenario they support

## Avoid

- mocking the very backend contract the test is supposed to validate
- waiting on every request instead of the one that matters
- leaving broad route interception in place across unrelated tests
- using network control as a substitute for fixing broken locator or assertion strategy

## Verification checklist

- the test still validates the intended product contract
- any mocking is narrow and intentional
- synchronization waits on meaningful events or outcomes
- API setup reduces noise instead of hiding the real behavior
- route interception is scoped tightly enough to debug easily

## Quick example

```ts
const responsePromise = page.waitForResponse((response) =>
  response.url().includes("/api/profile") && response.ok(),
);

await page.getByRole("button", { name: "Refresh profile" }).click();
await responsePromise;
await expect(page.getByText("Profile updated")).toBeVisible();
```

## Current snapshot

- Checked against official docs on 2026-04-03
- Current npm lines verified live on 2026-04-03: `playwright@1.59.1`, `@playwright/test@1.59.1`
- Docs in scope: network control and API testing

## Official references

- https://playwright.dev/docs/network
- https://playwright.dev/docs/api/class-apirequestcontext
- https://playwright.dev/docs/api-testing

## References

- [Network and API defaults](./references/network-and-api-defaults.md)
