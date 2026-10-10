---
name: nextjs-data-fetching-and-cache
description: Fetch data and control cache behavior in Next.js App Router. Use when tasks mention `fetch` in Server Components, request memoization, cache components, `use cache`, `unstable_cache`, `revalidatePath`, `revalidateTag`, `updateTag`, `generateStaticParams`, route-segment cache behavior, or deciding whether a route should stay static, dynamic, or revalidated.
---

# Next.js Data Fetching and Cache

Use this skill when the task is mostly about reading data in App Router or choosing the right cache and revalidation primitive.

## Scope

- server-first data fetching with `fetch`
- request memoization and route cache behavior
- `use cache`, `unstable_cache`, cache tags, and cache life decisions
- `revalidatePath`, `revalidateTag`, and `updateTag`
- `generateStaticParams` and static param generation
- high-level static vs dynamic vs revalidated route decisions

## Routing cues

- `fetch` in Server Components, request caching, revalidation, cache tags, `unstable_cache`, `use cache`, or `generateStaticParams` -> use this skill
- mutation flow, form submission, `use server`, or Route Handlers as the primary concern -> use `nextjs-server-actions-and-route-handlers`
- streaming and runtime boundaries as the main concern -> use `nextjs-rendering-runtime-and-middleware`

## Default path

1. Read [references/cache-and-revalidation-matrix.md](./references/cache-and-revalidation-matrix.md) first.
2. Decide whether the data is public, tenant-scoped, or user-specific before applying any cache primitive.
3. Prefer the smallest cache primitive that matches the invalidation needs.
4. Start with normal App Router `fetch` plus explicit `next` cache options before reaching for lower-level cache helpers.
5. Route out if the task turns into mostly mutation semantics or runtime placement.

## When to deviate

- Use `unstable_cache` only when plain `fetch` caching does not model the access pattern cleanly.
- Keep data fully dynamic when the response is personalized, auth-scoped, or otherwise unsafe to share.
- Reach for `generateStaticParams` only when route params are truly known ahead of time and the route benefits from static generation.
- Move to the server-actions skill when the invalidation story is attached to a mutation, not a read path.

## Quick example

```tsx
const posts = await fetch('https://api.example.com/posts', {
  next: { revalidate: 3600, tags: ['posts'] },
}).then((res) => res.json())
```

## Guardrails

- Do not apply public caching blindly to personalized or auth-scoped data.
- Prefer App Router cache primitives over legacy Pages Router data APIs.
- Treat `revalidatePath` as route-oriented invalidation and `revalidateTag` / `updateTag` as data-oriented invalidation.
- Reach for `unstable_cache` only when normal `fetch` caching does not fit the access pattern.
- Keep cache ownership obvious. Hidden invalidation paths age badly.

## Avoid

- caching user-specific or session-specific data as if it were public
- using `revalidatePath` and tag invalidation interchangeably without a clear ownership model
- introducing `unstable_cache` first and only later asking whether normal `fetch` would work
- mixing read-path cache guidance with mutation orchestration in the same answer

## Verification checklist

- the data scope is identified as public, tenant-scoped, or user-specific
- the chosen cache primitive matches the invalidation need
- route invalidation and data invalidation are not conflated
- personalized data is not accidentally cached as shared content
- the response routes to the mutation or runtime skill if the problem is no longer mainly about reads

## Canonical APIs

- `fetch`
- `generateStaticParams`
- `revalidatePath`
- `revalidateTag`
- `updateTag`
- `unstable_cache`
- `use cache`

## Maintenance

- Snapshot date: 2026-04-03
- Package snapshot: `next@16.2.2`
- Docs status snapshot: official App Router docs now center the cache model around Cache Components and `use cache`, while legacy cache APIs remain documented for compatibility and migration

## References

- [Cache and revalidation matrix](./references/cache-and-revalidation-matrix.md)
