# Rendering Runtime and Proxy

## Rendering boundary heuristics

- Server Component:
  - default choice
  - use for data access, secrets, and heavy server-only work
- Client Component:
  - only when browser APIs, local interaction state, or client hooks are required

## Runtime selection

- Node.js runtime:
  - safest default
  - widest package compatibility
- Edge runtime:
  - use when low-latency request handling matters and dependencies are compatible

## `proxy.ts` guidance

- Use it for request interception, redirects, rewrites, header mutation, auth gates, or coarse traffic shaping.
- Keep matcher coverage explicit.
- Do not move full endpoint logic into proxy when a Route Handler is the cleaner surface.

## Migration note

- Legacy `middleware.ts` guidance should be translated to `proxy.ts` unless the task is specifically about older code or migration history.
