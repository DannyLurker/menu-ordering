# Next.js Docs Map and Starting Points

## Use this skill first when

- the user needs to install or bootstrap Next.js
- the user is unsure whether a task belongs to App Router, Route Handlers, caching, or metadata
- the user asks about project shape, `src/app`, layouts, pages, route groups, or component boundaries

## Core docs map

- App Router overview: `docs/app`
- Installation and project bootstrap: `docs/app/getting-started/installation`
- Project structure and file conventions: `docs/app/getting-started/project-structure`
- Layouts and pages: `docs/app/getting-started/layouts-and-pages`
- Linking and navigation: `docs/app/getting-started/linking-and-navigating`
- Server and Client Components: `docs/app/getting-started/server-and-client-components`

## Follow-up routing

- Data reads, cache lifetime, and revalidation:
  - `nextjs-data-fetching-and-cache`
- Mutations, forms, Server Actions, and Route Handlers:
  - `nextjs-server-actions-and-route-handlers`
- Metadata, sitemap, robots, and OG images:
  - `nextjs-metadata-seo-and-file-conventions`
- Rendering mode, streaming, runtime, and `proxy.ts`:
  - `nextjs-rendering-runtime-and-middleware`

## Setup heuristics

- Prefer App Router for new projects unless the task explicitly depends on Pages Router-only APIs.
- Keep `app/layout.tsx` and `app/page.tsx` minimal at first.
- Decide client boundaries late. Most app code can stay server-first.
- If the user is blocked on "where does this logic live?", route by runtime surface before touching code.
