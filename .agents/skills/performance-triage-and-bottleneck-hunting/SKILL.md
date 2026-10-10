---
name: performance-triage-and-bottleneck-hunting
description: Use when something is slow but the owning bottleneck is still unclear. Covers choosing the right performance symptom, assigning likely layer ownership, and routing optimization work before the model starts changing random code.
---

# Performance Triage And Bottleneck Hunting

Use this skill when the real problem is finding the bottleneck, not prematurely applying optimizations.

## Scope

- slow pages, routes, interactions, and API endpoints
- unclear ownership between network, server, database, render, and bundle cost
- deciding whether performance work belongs to Next.js, React, Node.js, or infrastructure
- turning vague “this feels slow” reports into measurable bottlenecks

## Routing cues

- slow route, slow page load, high TTFB, bad interaction latency, render lag, hydration cost, p95 regression, or “where is the bottleneck” -> use this skill
- once the dominant cost is clearly React rerenders or state blast radius -> use `react-render-performance-and-state-boundaries`
- once the dominant cost is clearly Next.js route rendering, bundle, or client boundary cost -> use `nextjs-performance-and-render-cost`
- once the dominant cost is clearly API latency or server throughput -> use `nodejs-api-latency-and-throughput`
- once the bottleneck is already known and the task is measurement discipline -> use `profiling-before-optimizing`

## Default path

1. Restate the user-visible symptom in one sentence.
2. Choose one primary metric that represents the pain:
   - route TTFB
   - interaction latency
   - slow API duration
   - render or hydration time
   - memory growth or CPU saturation
3. Identify the likely owning layer before editing code:
   - network and third-party
   - server and database
   - React render tree
   - client bundle and hydration
4. Measure one representative path end to end.
5. Name the dominant bottleneck and only then route to the narrower optimization skill.

## When to deviate

- Use synthetic benchmarks only when the real user path is unavailable or too noisy.
- Start with production telemetry when it already exists and the local reproduction is misleading.
- Split into multiple bottlenecks only when one path truly has more than one dominant cost center.

## Guardrails

- Do not optimize before naming the metric and owning layer.
- Do not change several layers at once just because the app feels slow.
- Prefer the largest visible bottleneck over many tiny improvements.
- Keep user-facing latency separate from internal throughput or CPU efficiency.

## Avoid

- “performance pass” edits without a bottleneck hypothesis
- mixing database, render, and bundle work in one optimization step
- treating p50 improvement as success when p95 is the real problem
- guessing the bottleneck from code style instead of measurement

## Verification checklist

- the user-visible symptom is explicit
- one primary metric is chosen
- the likely owning layer is named
- a dominant bottleneck is identified before optimization starts
- the response routes to a narrower skill if triage is complete

## Output Shape

When answering with this skill, prefer:

- symptom
- primary metric
- likely owning layer
- dominant bottleneck hypothesis
- next measurement or next specialized skill

## References

- [Layer ownership checklist](./references/layer-ownership-checklist.md)
