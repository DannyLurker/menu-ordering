# Composition Defaults And Wrapper Boundaries

Default composition posture:

- use copied primitives directly first
- compose locally
- extract wrappers only after the pattern repeats

Good reasons for a wrapper:

- repeated semantic contract
- repeated interaction wiring
- repeated analytics or telemetry hooks
- repeated accessibility glue that should not be duplicated

Bad reasons for a wrapper:

- “we might need flexibility later”
- hiding a simple primitive behind a prop-heavy façade
- copying an example into a generic abstraction before the usage pattern is stable

`asChild` default:

- use it when you need to preserve the child element contract
- do not use it mechanically everywhere
- verify semantics, focus behavior, and click target behavior afterward
