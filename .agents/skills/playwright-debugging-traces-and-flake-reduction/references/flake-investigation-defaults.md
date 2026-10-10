# Flake Investigation Defaults

Default investigation loop:

1. reproduce
2. capture trace
3. inspect the failing action and assertion
4. identify whether the root issue is locator, assertion, auth, network, or environment
5. fix that contract directly

Codegen rule:

- use it to inspect selectors and flows
- do not commit the generated file without heavy cleanup

Retry rule:

- retries can protect CI from noise
- retries do not explain failures
- if a test needs more retries to look green, the root problem is still present
