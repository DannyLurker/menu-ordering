---
name: performance-regression-verification
description: Use when someone claims a performance improvement or worries about a regression and needs proof. Covers before-versus-after comparison, stable verification scenarios, user-visible metrics, and guarding against “faster on my machine” conclusions.
---

# Performance Regression Verification

Use this skill when the job is proving performance got better, stayed stable, or regressed in a meaningful way.

## Scope

- before and after comparison
- guarding against accidental slowdowns
- verifying optimizations before shipping
- choosing the right metric and acceptance bar
- separating real improvement from benchmark noise

## Default path

1. Name the scenario being protected.
2. Choose the metric that matters for that scenario.
3. Compare the same path before and after.
4. Check both user-visible improvement and correctness.
5. Report confidence and residual risk instead of pretending performance is binary.

## When to deviate

- Use percentile data when tail latency matters more than averages.
- Use smoke thresholds rather than exact equality when CI noise is unavoidable.
- Prefer field telemetry over lab checks when synthetic runs miss the real pain.

## Guardrails

- Compare the same scenario, environment, and data shape when possible.
- Do not call a change “faster” without saying what metric improved.
- Do not treat tiny wins as meaningful if the user-visible bottleneck remains.
- Keep correctness, stability, and resource usage in the verification story.

## Avoid

- “feels faster” as the only evidence
- comparing different inputs or environments
- only reporting averages when tail latency is the real issue
- dropping regression checks once the optimization ships

## Verification checklist

- the protected scenario is explicit
- before and after use the same metric
- correctness was checked alongside speed
- the improvement or regression is stated with confidence level
- residual noise or risk is named

## Output Shape

When answering with this skill, prefer:

- scenario under test
- metric and threshold
- before vs after result
- confidence level
- ship / hold recommendation

## References

- [Regression checklist](./references/regression-checklist.md)
