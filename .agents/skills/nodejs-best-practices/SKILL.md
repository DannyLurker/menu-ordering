---
name: nodejs-best-practices
description: Use when building or debugging Node.js applications and libraries. Covers modules, async flows, streams, testing, shutdown, environment handling, logging, performance, and modern TypeScript execution choices in Node.js.
---

# Node.js Best Practices

Use this skill for Node.js runtime decisions rather than framework-specific concerns.

## Scope

- ESM vs CommonJS and import strategy
- async error handling and process boundaries
- streams, backpressure, and pipeline-based processing
- tests, flaky teardown, and stuck processes
- graceful shutdown and resource cleanup
- environment and configuration handling
- logging, profiling, and performance investigation
- modern TypeScript execution in Node.js

## Default path

1. Identify whether the task is runtime behavior, module loading, stream processing, test stability, or operational hardening.
2. Keep I/O boundaries explicit: files, network, child processes, queues, and caches.
3. Prefer `async` and `await` with clear error boundaries over nested Promise chains.
4. For stream-heavy work, prefer `pipeline()` and make backpressure visible in the design.
5. Separate startup config validation from request or job execution.
6. On shutdown, stop intake first, then drain in-flight work, then close external resources.
7. When debugging performance, reproduce first, measure second, then optimize.

## When to deviate

- Use CommonJS only when the runtime, tooling, or published package surface still requires it.
- Reach for worker threads only when the bottleneck is truly CPU-bound and isolation helps.
- Move to framework skills when the problem is no longer Node runtime design but framework behavior.

## Guardrails

- Do not mix ESM and CommonJS patterns casually in the same runtime surface.
- Do not treat `process.env` reads as unbounded global state. Normalize config once.
- Do not swallow async errors in background jobs or event handlers.
- Do not build large file or ETL flows around `.pipe()` chains if `pipeline()` gives better failure handling.
- Do not rely on tests passing locally if teardown is nondeterministic.
- Treat native TypeScript execution features as runtime-sensitive and verify them against the current Node docs before standardizing on them.

## Avoid

- mixing ESM and CommonJS casually
- reading `process.env` everywhere instead of normalizing config once
- swallowing async errors in background work
- optimizing before reproduction and measurement

## Verification checklist

- the runtime boundary owning the problem is explicit
- config is normalized once
- async and stream patterns have clear failure handling
- shutdown order is deliberate
- performance work follows reproduce -> measure -> optimize

## Common Routing Cues

- Node.js, streams, `pipeline`, `AbortController`, ESM, CommonJS, worker threads, shutdown, flaky tests, `node:test`, profiling, type stripping, runtime config

## Output Shape

When answering with this skill, prefer:

- the runtime boundary that owns the problem
- the safest async or stream pattern
- the shutdown or teardown contract
- the minimal config and script shape
- the measurement path for performance work

## Official Docs

- https://nodejs.org/docs/latest/api/
- https://nodejs.org/docs/latest/api/stream.html
- https://nodejs.org/docs/latest/api/test.html
- https://nodejs.org/docs/latest/api/process.html
- https://nodejs.org/docs/latest/api/typescript.html
