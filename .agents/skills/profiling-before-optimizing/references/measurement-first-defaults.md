# Measurement-First Defaults

## Prefer these in order

1. User-visible symptom
2. Baseline metric
3. Representative scenario
4. Profiler capture
5. Dominant hotspot
6. Smallest optimization
7. Re-measurement

## Default profilers by layer

- React render cost: React DevTools Profiler
- browser main-thread cost: Chrome Performance panel
- Node.js CPU hotspots: `--cpu-prof`
- memory churn: heap snapshots or allocation profiling

## Anti-pattern

Do not use code style heuristics as a proxy for performance truth. A clean-looking abstraction can be cheap, and ugly code can still be fast enough.
