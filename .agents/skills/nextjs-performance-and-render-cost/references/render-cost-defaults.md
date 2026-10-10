# Render Cost Defaults

## Cheapest default path

- server-first route
- narrow client islands
- cached or static data when possible
- minimal root providers
- delayed or removed third-party scripts

## Most common expensive mistakes

- large `'use client'` trees
- dynamic routes without a product reason
- providers or stateful wrappers at the app root
- shipping large browser-only SDKs to every route
