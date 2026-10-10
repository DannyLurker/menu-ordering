---
name: nextjs-server-actions-and-route-handlers
description: Build safe mutation and API boundaries in Next.js App Router. Use when tasks mention `use server`, Server Functions, Server Actions, Route Handlers, `route.ts`, form `action`, `formAction`, cookies, redirects after mutations, request and response handling, or deciding between UI-driven mutation flow and explicit HTTP endpoints.
---

# Next.js Server Actions and Route Handlers

Use this skill when the task is primarily about mutation boundaries, server-only execution, or deciding whether code belongs in a Server Action or a Route Handler.

## Scope

- `use server` and Server Function placement
- Server Actions for form and UI-driven mutations
- Route Handlers for explicit HTTP endpoints
- redirects, refreshes, cookies, and post-mutation cache invalidation
- request and response handling with `NextRequest` and `NextResponse`
- auth and validation guardrails for mutation surfaces

## Routing cues

- `use server`, form actions, mutation flow, cookies, redirects, or Route Handlers -> use this skill
- cache strategy and invalidation ownership as the main question -> use `nextjs-data-fetching-and-cache`
- metadata, sitemap, or robots concerns -> use `nextjs-metadata-seo-and-file-conventions`
- runtime placement or `proxy.ts` as the main concern -> use `nextjs-rendering-runtime-and-middleware`

## Default path

1. Read [references/server-boundaries-and-handler-selection.md](./references/server-boundaries-and-handler-selection.md) first.
2. Decide whether the caller is UI-bound or protocol-bound before writing code.
3. Validate input and enforce auth inside every Server Action and Route Handler.
4. Pair mutations with explicit cache refresh strategy instead of relying on incidental reloads.

## When to deviate

- Prefer a Route Handler when the caller is external, protocol-specific, or not driven by your own UI.
- Prefer a Server Action when the mutation is initiated directly from your app UI or a form.
- Move to the cache skill when the hard problem is invalidation strategy rather than mutation boundary choice.
- Move to the runtime skill when the real question is execution placement or interception before the route runs.

## Quick example

```ts
'use server'

import { revalidatePath } from 'next/cache'

export async function savePost(formData: FormData) {
  await db.post.create({
    data: { title: String(formData.get('title') ?? '') },
  })
  revalidatePath('/posts')
}
```

## Guardrails

- Server Functions are reachable by networked POST requests. Treat them as real server surfaces, not hidden callbacks.
- Prefer Server Actions for mutations initiated by your own UI.
- Prefer Route Handlers for webhooks, third-party callers, non-HTML clients, or protocol-specific behavior.
- Keep secrets and privileged helpers on the server boundary only.
- Use `redirect`, `revalidatePath`, `revalidateTag`, and cookies intentionally after successful mutations.

## Avoid

- treating Server Actions like private in-process callbacks with no auth or validation
- using Route Handlers for every internal mutation just because they look familiar
- relying on page reloads instead of explicit post-mutation cache strategy
- mixing webhook or third-party API behavior into UI-centric Server Action guidance

## Verification checklist

- the caller is clearly classified as UI-bound or protocol-bound
- auth and validation happen inside the server boundary
- post-mutation redirect or invalidation behavior is explicit
- secrets remain on the server side only
- the chosen boundary is Server Action vs Route Handler for a reason, not by habit

## Canonical APIs

- `use server`
- `redirect`
- `refresh`
- `revalidatePath`
- `revalidateTag`
- `cookies`
- `headers`
- `NextRequest`
- `NextResponse`

## Maintenance

- Snapshot date: 2026-04-03
- Package snapshot: `next@16.2.2`
- Docs status snapshot: official docs distinguish the broad Server Function model from the narrower Server Action mutation pattern

## References

- [Server boundaries and handler selection](./references/server-boundaries-and-handler-selection.md)
