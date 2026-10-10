# Layer Ownership Checklist

Use this reference to avoid optimizing the wrong layer.

## Server / API dominated

- slow TTFB even before the browser starts rendering
- endpoint p95 is high
- expensive serialization or repeated I/O per request
- database or external service dominates the request path

## React dominated

- input lag after the data already arrived
- one local interaction rerenders a large subtree
- DevTools shows expensive renders rather than slow network

## Next.js route / bundle dominated

- route is dynamic without needing to be
- too many client boundaries near the top of the tree
- hydration cost is large on first load
- third-party scripts or large client bundles dominate startup

## Network / third-party dominated

- waterfall from multiple remote calls
- blocking scripts or remote assets delay route completion
- backend is fine locally but slow with real network conditions

## Default rule

Name the bottleneck owner before proposing a fix. If the owner is unclear, keep measuring instead of optimizing.
