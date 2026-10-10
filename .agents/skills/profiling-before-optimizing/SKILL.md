---
name: profiling-before-optimizing
description: Use when someone wants to optimize code but the team has not profiled it yet. Covers baseline capture, profiling representative scenarios, finding dominant hotspots, and refusing performance folklore as a substitute for measurement.
---

# Profiling Before Optimizing

Use this skill when the dangerous move would be optimizing first and measuring later.

## Scope

- CPU profiling
- render profiling
- flamegraph-driven optimization
- memory and allocation inspection
- turning vague “this seems expensive” claims into measured hotspots

## Routing cues

- profile this, measure before optimizing, find hotspot, flamegraph, CPU profile, React Profiler, Chrome Performance, `--cpu-prof`, or memory investigation -> use this skill
- if the main problem is still figuring out which layer owns the slowdown -> use `performance-triage-and-bottleneck-hunting`
- if the optimization claim now needs proof after the change -> use `performance-regression-verification`

## Default path

1. Freeze one representative scenario.
2. Capture a baseline metric before changing code.
3. Profile the same scenario using the right profiler for the layer.
4. Find the dominant hotspot rather than every visible one.
5. Change the smallest boundary that removes that hotspot.
6. Re-run the same profile and compare against the baseline.

## When to deviate

- Use lightweight timing only when a full profiler would distort the scenario more than it helps.
- Skip low-level profiling if the true bottleneck is obviously network or database latency owned elsewhere.
- Use allocation or heap tools when CPU is fine but memory churn is the problem.

## Guardrails

- Profile representative flows, not toy microbenchmarks, unless the task is explicitly low-level.
- Compare the same scenario before and after the change.
- Do not optimize secondary hotspots while the primary one still dominates.
- Keep correctness and readability in scope when the performance gain is marginal.

## Avoid

- tuning code because it “looks expensive”
- using one profiler capture as truth without a stable scenario
- celebrating a flamegraph improvement without a user-visible gain
- piling on memoization, caching, or batching before measuring the actual hotspot

## Verification checklist

- a baseline exists
- the scenario is representative
- the dominant hotspot is named
- the optimization changed the owning boundary, not random nearby code
- the same measurement path was used after the change

## Output Shape

When answering with this skill, prefer:

- scenario
- baseline
- profiler to use
- dominant hotspot
- smallest justified optimization

## References

- [Measurement-first defaults](./references/measurement-first-defaults.md)
