---
name: nextjs-metadata-seo-and-file-conventions
description: Manage metadata and SEO surfaces in Next.js App Router. Use when tasks mention `metadata`, `generateMetadata`, `generateViewport`, `ImageResponse`, Open Graph or Twitter images, `robots.txt`, `sitemap.xml`, `manifest.json`, JSON-LD, canonical URLs, or deciding between metadata exports and metadata file conventions.
---

# Next.js Metadata, SEO, and File Conventions

Use this skill when the task is mostly about search, sharing, metadata composition, or App Router file-convention outputs.

## Scope

- static `metadata` exports and dynamic `generateMetadata`
- `generateViewport`
- metadata files like `robots.txt`, `sitemap.xml`, `manifest.json`, and icons
- Open Graph and Twitter image workflows
- canonical URLs and structured data placement
- choosing file conventions vs runtime functions

## Routing cues

- `generateMetadata`, metadata objects, OG images, Twitter images, `robots.txt`, sitemap, manifest, icons, canonical URLs, or JSON-LD -> use this skill
- data loading and cache invalidation as the primary problem -> use `nextjs-data-fetching-and-cache`
- Route Handlers or mutation boundaries as the primary concern -> use `nextjs-server-actions-and-route-handlers`

## Default path

1. Read [references/metadata-and-file-conventions.md](./references/metadata-and-file-conventions.md) first.
2. Decide whether the output is static, request-aware, or generated from content state.
3. Prefer file conventions for stable framework-owned outputs.
4. Keep canonical URL logic and public URL assembly centralized.

## When to deviate

- Use `generateMetadata` only when metadata actually depends on params, search params, or fetched content.
- Generate OG images at runtime only when static image assets are not enough.
- Move to the data-fetching skill when the hard part is content loading or cache ownership rather than metadata composition.
- Use a Route Handler only when the framework file convention does not own the output surface.

## Quick example

```ts
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Docs',
  description: 'Product documentation',
}
```

## Guardrails

- Prefer static `metadata` when values do not depend on request-time data.
- Use `generateMetadata` only when metadata genuinely depends on params, search params, or fetched content.
- Keep sitemap, robots, and canonical URLs derived from the same source of truth.
- Use metadata file conventions instead of hand-rolled endpoints when the framework already owns the surface.
- Treat OG-image generation as a public runtime surface with performance and cache implications.

## Avoid

- duplicating canonical URL assembly in multiple files
- using runtime metadata generation for values that could be static
- hand-rolling endpoints for `robots.txt`, sitemap, or manifest when the file convention already exists
- mixing SEO logic with unrelated mutation or API concerns

## Verification checklist

- the surface is classified correctly as static, request-aware, or content-driven
- file conventions are used where Next.js already provides them
- canonical URLs, sitemap entries, and robots rules come from a shared source of truth
- runtime OG image generation is justified rather than habitual
- the response routes to cache or server-boundary skills if metadata is not the primary decision

## Canonical APIs

- `metadata`
- `generateMetadata`
- `generateViewport`
- `ImageResponse`
- `robots.txt`
- `sitemap.xml`
- `manifest.json`

## Maintenance

- Snapshot date: 2026-04-03
- Package snapshot: `next@16.2.2`
- Docs status snapshot: official docs group metadata exports and metadata files together under App Router metadata conventions

## References

- [Metadata and file conventions](./references/metadata-and-file-conventions.md)
