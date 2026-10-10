# Server Boundaries and Handler Selection

## Choose the surface first

- Server Action:
  - mutation initiated by your own React UI
  - especially forms and action-driven buttons
- Route Handler:
  - explicit HTTP endpoint
  - webhooks, cron callbacks, machine clients, file responses, or CORS-aware APIs

## Use Server Actions when

- the caller is a component you control
- the return path is mostly UI refresh plus cache invalidation
- you want built-in form wiring and progressive enhancement

## Use Route Handlers when

- the caller is external or non-React
- you need method routing, explicit status codes, or custom response bodies
- the endpoint must be consumed outside the app shell

## Shared guardrails

- validate input
- enforce authentication and authorization in the server boundary
- define cache refresh steps explicitly
- keep idempotency in mind for retry-prone integrations like webhooks
