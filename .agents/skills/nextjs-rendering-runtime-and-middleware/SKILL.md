---
name: nextjs-rendering-runtime-and-middleware
description: Choose rendering mode and request runtime boundaries in Next.js App Router. Use when tasks mention Server vs Client Components, static vs dynamic rendering, streaming, route segment config, `runtime = 'edge'`, Node.js vs Edge decisions, or legacy middleware questions that now map to `proxy.ts`.
---

# Next.js Rendering Runtime and Middleware

Use this skill when the task is primarily about rendering model, runtime placement, or request interception before the route completes.

## Scope

- Server Components vs Client Components as rendering boundaries
- static, dynamic, and streamed rendering choices
- route segment config and runtime selection
- Node.js vs Edge runtime tradeoffs
- `proxy.ts` and matcher-based request interception
- migration framing from legacy `middleware.ts` naming

## Routing cues

- rendering mode, streaming, component runtime split, route segment config, Node vs Edge, or middleware / proxy questions -> use this skill
- data reads and cache invalidation as the primary concern -> use `nextjs-data-fetching-and-cache`
- mutation flow or Route Handlers as the primary concern -> use `nextjs-server-actions-and-route-handlers`
- metadata and sitemap surfaces as the primary concern -> use `nextjs-metadata-seo-and-file-conventions`

## Default path

1. Read [references/rendering-runtime-and-proxy.md](./references/rendering-runtime-and-proxy.md) first.
2. Decide the rendering boundary before adding `'use client'` or Edge runtime flags.
3. Keep `proxy.ts` narrow and matcher-driven. Route endpoint logic elsewhere.
4. Choose runtime based on platform constraints, package support, and latency goals, not fashion.

## When to deviate

- Add `'use client'` only when state, effects, refs, or browser APIs force a client boundary.
- Use Edge runtime only when latency, geography, or platform constraints justify the narrower compatibility surface.
- Reach for `proxy.ts` only when the request truly needs interception before the route completes.
- Move to the data or server-boundary skills when rendering is no longer the main decision surface.

## Quick example

```ts
export const runtime = 'edge'
```

## Guardrails

- Server Components are the default. Client Components are an opt-in boundary.
- Do not use `proxy.ts` as a general replacement for Route Handlers or app business logic.
- The `middleware` file convention is deprecated; use `proxy.ts` / `proxy.js` terminology and file naming.
- Edge runtime compatibility is narrower than Node.js. Verify package support before moving code there.
- Prefer explicit matcher rules and keep interception logic easy to reason about.

## Avoid

- adding `'use client'` high in the tree without a concrete runtime need
- moving code to Edge because it sounds faster without checking compatibility
- using `proxy.ts` as a dumping ground for business logic
- mixing rendering guidance with mutation or cache policy advice unless that surface is truly dominant

## Verification checklist

- server vs client boundaries are explicit and justified
- runtime choice is tied to real constraints, not habit
- `proxy.ts` remains narrow and matcher-based
- deprecated `middleware` naming is not suggested for new work
- the response routes out if cache or mutation concerns now dominate

## Canonical surfaces

- `'use client'`
- `runtime`
- `preferredRegion`
- `maxDuration`
- `proxy.ts`
- `NextRequest`
- `NextResponse`

## Maintenance

- Snapshot date: 2026-04-03
- Package snapshot: `next@16.2.2`
- Docs status snapshot: official docs now document `proxy.ts` as the request-interception file convention and mark legacy `middleware` naming as deprecated

## References

- [Rendering runtime and proxy](./references/rendering-runtime-and-proxy.md)
