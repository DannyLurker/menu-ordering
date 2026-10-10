---
name: nextjs-performance-and-render-cost
description: Use when a Next.js App Router route is slow because of render cost, client bundle weight, hydration work, or weak server-client boundaries. Covers server-first rendering, client boundary minimization, route cost diagnosis, and avoiding fashionable but expensive patterns.
---

# Next.js Performance And Render Cost

Use this skill when the main problem is route performance, render cost, or startup weight in a Next.js app.

## Scope

- route render cost
- client bundle and hydration weight
- excessive client boundaries
- dynamic rendering where static or cached work would be cheaper
- third-party script cost in Next.js routes

## Routing cues

- slow App Router route, high TTFB, hydration cost, heavy client bundle, too many client components, route render cost, slow initial load -> use this skill
- if the main question is cache invalidation or fetch policy -> use `nextjs-data-fetching-and-cache`
- if the main question is runtime or request interception -> use `nextjs-rendering-runtime-and-middleware`
- if the main question is pure React rerender scope inside a client subtree -> use `react-render-performance-and-state-boundaries`

## Default path

1. Keep the route server-first by default.
2. Push `'use client'` as low as possible in the tree.
3. Make expensive data reads static or cached when the product model allows it.
4. Avoid broad client providers near the root unless they truly need to wrap the route.
5. Audit third-party scripts and SDKs before micro-optimizing component code.
6. Optimize the heaviest route segment or client boundary first.

## When to deviate

- Accept a larger client surface only when the route is genuinely interaction-heavy.
- Keep a route dynamic only when personalization or rapidly changing data truly requires it.
- Stream partial UI only when it improves perceived latency instead of complicating the route for little gain.

## Guardrails

- Server Components are cheaper than unnecessary Client Components.
- Large client boundaries near the root usually multiply hydration and rerender cost.
- Do not mark a route dynamic by habit.
- Third-party script and SDK cost is part of route performance, not somebody else’s problem.

## Avoid

- adding `'use client'` to large route segments for convenience
- wrapping the whole app in client providers for one local feature
- keeping routes dynamic when the product model allows static or cached output
- optimizing tiny component details while shipping a heavy client graph

## Verification checklist

- server vs client boundaries are justified
- route dynamic behavior is intentional
- bundle and hydration cost were considered
- largest route or boundary cost was targeted first
- the route got simpler or cheaper, not just more clever

## Official references

- https://nextjs.org/docs/app/building-your-application/rendering
- https://nextjs.org/docs/app/building-your-application/data-fetching
- https://nextjs.org/docs/app/getting-started/server-and-client-components

## References

- [Render cost defaults](./references/render-cost-defaults.md)
