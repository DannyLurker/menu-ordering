# Metadata and File Conventions

## Prefer static exports when possible

- `export const metadata`:
  - best for route-stable metadata
- `generateMetadata(...)`:
  - best when metadata depends on params or fetched content

## Prefer file conventions for framework-owned outputs

- `app/robots.ts` or `app/robots.txt`
- `app/sitemap.ts` or `app/sitemap.xml`
- `app/manifest.ts` or `app/manifest.json`
- `app/opengraph-image.tsx`
- `app/twitter-image.tsx`
- icon files and metadata icon conventions

## Common heuristics

- Canonical URL logic should be centralized, not rebuilt ad hoc in each route.
- If multiple routes share URL derivation, expose one helper and reuse it.
- Use JSON-LD intentionally and keep it consistent with visible page data.
- Dynamic OG images are runtime work. Avoid making them heavier than the page they represent.
