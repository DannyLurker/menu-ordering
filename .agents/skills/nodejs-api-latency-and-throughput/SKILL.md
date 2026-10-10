---
name: nodejs-api-latency-and-throughput
description: Use when a Node.js API is slow because of per-request work, bad concurrency shape, I/O amplification, or weak throughput defaults. Covers p95-first analysis, request path simplification, batching, cancellation, and avoiding fake optimizations that hurt operability.
---

# Node.js API Latency And Throughput

Use this skill when the problem is API performance under real request load, not generic runtime style.

## Scope

- endpoint latency
- throughput under concurrency
- repeated per-request setup
- I/O amplification
- expensive serialization or CPU work in hot paths

## Default path

1. Pick the slow endpoint or request class.
2. Measure p50 and p95 before changing code.
3. Remove repeated per-request setup first:
   - config parsing
   - client construction
   - redundant auth or schema work
4. Batch or collapse avoidable I/O.
5. Keep concurrency bounded and intentional.
6. Move CPU-heavy work off the hot request path only when measurement shows it dominates.

## When to deviate

- Favor p95 and p99 over throughput if the business pain is tail latency.
- Trade some peak throughput for safer memory or better cancellation when the API is interactive.
- Stream responses only when it reduces real wait time or memory pressure.

## Guardrails

- Tail latency usually matters more than one fast happy-path benchmark.
- Reusing clients and connections is often higher leverage than clever code changes.
- `Promise.all` is not a free win when it creates downstream pressure or burst load.
- Keep request cancellation and timeouts in the design when external I/O is involved.

## Avoid

- building clients or pools inside the request handler
- unbounded concurrency in a hot path
- optimizing CPU when network or database dominates
- reporting throughput gains while hiding worse tail latency or memory spikes

## Verification checklist

- endpoint and percentile metric are explicit
- per-request setup was audited
- concurrency shape is intentional
- the dominant I/O or CPU bottleneck is named
- p95 or user-visible latency improved, not just synthetic throughput

## Official references

- https://nodejs.org/docs/latest/api/http.html
- https://nodejs.org/docs/latest/api/stream.html
- https://nodejs.org/docs/latest/api/perf_hooks.html

## References

- [Latency and throughput defaults](./references/latency-and-throughput-defaults.md)
