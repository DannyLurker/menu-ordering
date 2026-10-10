# Latency And Throughput Defaults

## High-leverage first checks

- per-request client construction
- repeated config or schema parsing
- N+1 remote calls
- oversized response payloads
- unbounded parallel work

## Default priorities

1. tail latency
2. repeated setup cost
3. I/O amplification
4. bounded concurrency
5. CPU hotspots

## Rule

Do not trade observability, cancellation, and correctness for benchmark theater.
