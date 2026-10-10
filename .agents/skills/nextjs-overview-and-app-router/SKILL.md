---
name: nextjs-overview-and-app-router
description: Set up Next.js App Router, choose the right starting path, and route work to the correct follow-up Next.js skill. Use when tasks mention `create-next-app`, App Router installation, project structure, layouts, pages, linking, navigation, Server vs Client Components, path aliases, `src/app`, App Router vs Pages Router decisions, or Next.js version and upgrade questions.
---

# Next.js Overview and App Router

Use this skill when the task is primarily about choosing the right Next.js starting path, understanding App Router structure, or deciding which Next.js surface owns the work.

## Scope

- App Router docs topology and pack routing
- installation and starter decisions
- core file conventions like `app/`, `layout.tsx`, `page.tsx`, and route groups
- high-level Server Components vs Client Components framing
- version and upgrade awareness

## Routing cues

- install Next.js, create a new app, choose App Router, understand file conventions, or decide where a Next.js task belongs -> use this skill
- `fetch`, caching, revalidation, `use cache`, `unstable_cache`, `revalidateTag`, or `revalidatePath` -> use `nextjs-data-fetching-and-cache`
- `use server`, Server Actions, Route Handlers, form actions, cookies, redirects after mutations, or backend mutation flow -> use `nextjs-server-actions-and-route-handlers`
- metadata, OG images, `generateMetadata`, JSON-LD, `robots.txt`, or `sitemap.xml` -> use `nextjs-metadata-seo-and-file-conventions`
- rendering mode selection, streaming, runtime boundaries, `runtime = 'edge'`, or legacy middleware / new `proxy.ts` work -> use `nextjs-rendering-runtime-and-middleware`

## Default path

1. Read [references/docs-map-and-starting-points.md](./references/docs-map-and-starting-points.md) first.
2. Treat App Router as the default for new Next.js work.
3. Keep the initial setup minimal: `app/`, root `layout.tsx`, route `page.tsx`, and only the files needed for the current slice.
4. Default to Server Components and add `'use client'` only where browser-only interactivity is actually needed.
5. Route out quickly once the task becomes mostly about caching, mutations, SEO, or rendering runtime.

## When to deviate

- Switch to Pages Router guidance only if the repo is already Pages-based or the task explicitly targets Pages APIs.
- Add `'use client'` only when state, effects, refs, browser APIs, or client-only hooks are required.
- Reach for `proxy.ts` or runtime-specific logic only when the task is clearly about request interception or execution boundaries.

## Quick example

```bash
npx create-next-app@latest my-app
```

## Guardrails

- Treat App Router as the default center of gravity for this pack.
- Do not mix Pages Router data APIs like `getServerSideProps` into App Router guidance.
- Server Components are the default; add `'use client'` only where browser-only interactivity is actually needed.
- Use this skill to orient and route, not to answer deep cache, mutation, or SEO questions by itself.

## Avoid

- building new App Router work around `pages/` conventions by habit
- putting client components at the top of the tree without a concrete reason
- answering cache, metadata, or server-action questions inside this skill when a sibling skill owns the decision
- turning initial setup into a full architecture rewrite before the actual task is clear

## Verification checklist

- the task is confirmed to be App Router work, not Pages Router work
- the advice keeps `app/` file conventions intact
- `'use client'` is only added where it is actually needed
- no Pages Router data APIs are mixed into the recommendation
- the response clearly routes to a sibling skill if the work is really about cache, actions, SEO, or runtime

## Canonical references

- https://nextjs.org/docs/app
- https://nextjs.org/docs/app/getting-started/installation
- https://nextjs.org/docs/app/getting-started/project-structure
- https://nextjs.org/docs/app/getting-started/layouts-and-pages
- https://nextjs.org/docs/app/getting-started/linking-and-navigating
- https://nextjs.org/docs/app/getting-started/server-and-client-components
- https://nextjs.org/docs/app/getting-started/upgrading

## Current snapshot

- Checked against official docs on 2026-04-03
- Latest App Router docs version in scope: Next.js `16.2.2`
- Current npm line verified live on 2026-04-03: `next@16.2.2`

## References

- [Docs map and starting points](./references/docs-map-and-starting-points.md)
