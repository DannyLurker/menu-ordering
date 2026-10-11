# 0001. Stack and architecture

**Date**: 2026-10-10
**Status**: Accepted

## Summary

This spec records the foundation stack for the Biz Hotel Batam menu ordering app (a web app where hotel guests order food from the room and kitchen staff follow each order live). You keep the Next.js TypeScript monolith you already run, add Prisma 7 with PostgreSQL for data, BetterAuth for staff sign in, socket.io rooms for the live order flow, and Docker Compose to run it all. Every layer is boring and proven, so Slice 1 can prove the full order loop on real structure.

## Decision

**Chosen option**: Option A: Next.js monolith with Prisma, BetterAuth, socket.io, Docker.

You build a single Next.js TypeScript app (a monolith, meaning one codebase and one running server for all screens and APIs) with Prisma 7 talking to PostgreSQL, BetterAuth for staff identity, socket.io rooms for live updates, REST route handlers for data APIs, in memory LRU limiting for PIN retries, and structured console logs, all packed in Docker Compose (basis: your scope agreement, the agreed stack for V1.1; basis: already in code, server.ts plus app/page.tsx).

**Implementation skills**: `vercel-react-best-practices` (`vercel-labs/agent-skills`, `.agents/skills/vercel-react-best-practices/`) · `nextjs-app-router-patterns` (`wshobson/agents`, `.agents/skills/nextjs-app-router-patterns/`) · `tailwind-design-system` (`wshobson/agents`, `.agents/skills/tailwind-design-system/`) · `prisma-client-api` (`prisma/skills`, `.agents/skills/prisma-client-api/`) · `prisma-orm-setup` (`prisma/skills`, `.agents/skills/prisma-orm-setup/`) · `better-auth-best-practices` (`better-auth/skills`, `.agents/skills/better-auth-best-practices/`)

## Proposed stack

| Layer             | Choice                                                                                                                              | Reason                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language          | TypeScript (strict)                                                                                                                 | Already the codebase language, keeps every later slice typed (basis: already in code, package.json plus tsconfig.json).                                                                                                                                                                                                                                                                                                                                                                  |
| Framework         | Next.js 16 App Router, React 19                                                                                                     | Already running, one framework serves screens plus APIs plus the socket server (basis: already in code, server.ts plus app/page.tsx).                                                                                                                                                                                                                                                                                                                                                    |
| Primary DB        | PostgreSQL via Prisma 7, pinned to 7.x                                                                                              | Relational data (stays, orders, folio lines) wants joins and constraints, Prisma removes CRUD boilerplate (basis: your scope agreement, the agreed stack for V1.1; basis: relational database as the default, boring technology wins).                                                                                                                                                                                                                                                   |
| Auth              | BetterAuth 1.7 with Prisma adapter                                                                                                  | Self hosted staff identity with sessions in your own database, no outside vendor, fits Next 16 plus Prisma 7 (basis: your scope agreement; basis: never build auth by hand).                                                                                                                                                                                                                                                                                                             |
| Live updates      | socket.io 4.8 on the custom server, rooms per stay plus one kitchen room                                                            | Already wired in server.ts, rooms scope each order event to its stay and the kitchen board only (basis: already in code, server.ts; basis: boring technology wins).                                                                                                                                                                                                                                                                                                                      |
| API shape         | REST Route Handlers plus socket events                                                                                              | Simple fetch calls plus live events fit the tracer bullet thin loop, easy to trace and test per endpoint (basis: simplest thing that covers the loop).                                                                                                                                                                                                                                                                                                                                   |
| Rate limiting     | `lru-cache` v11, in memory, single instance                                                                                         | Free PIN retry limiting with zero infrastructure, correct for one hotel on one server (basis: your scope agreement, free rate limiting; basis: ephemeral cache, never a primary store).                                                                                                                                                                                                                                                                                                  |
| Hosting           | Docker Compose, app plus PostgreSQL, entrypoint stays `server.ts`                                                                   | One compose file reproduces prod locally, the custom socket server needs its own entrypoint (basis: your scope agreement, docker; basis: landscape check, Next 16.4 output docs). Compose rules: named volume for Postgres data, healthcheck on the database, app starts on `depends_on` healthy so Prisma never connects too early. Devs run full Compose always, one path, one failure mode. Port comes from `PORT`, default 3000, one shared HTTP server handles routes plus sockets. |
| Runtime           | `tsx server.ts` in dev, Node on the built output through `server.ts` in prod                                                        | Same entrypoint everywhere keeps socket behavior identical across envs.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Versions          | Exact floors with lockfile committed: Next 16.4.0, React 19.3.0, socket.io 4.8.4, `lru-cache` 11.x, Prisma 7.x, `better-auth` 1.7.x | Exact floors stop silent upgrades, the Prisma 7.x ceiling holds until a deliberate 8 upgrade.                                                                                                                                                                                                                                                                                                                                                                                            |
| Auth config       | Base path `/api/auth`, staff sign in by email plus password, cookie sessions                                                        | One base path plus one staff method keeps the auth spec small (detail: auth and roles spec).                                                                                                                                                                                                                                                                                                                                                                                             |
| Socket join rules | Kitchen room gated by staff session, stay room gated by verified stay session, never by client claim                                | Rooms are names, not security, the join rule is the security (detail: real time foundation spec).                                                                                                                                                                                                                                                                                                                                                                                        |
| PIN limiter split | LRU holds counters, Postgres stays authoritative                                                                                    | In memory speed with durable truth, the two specs cannot conflict (detail: data model spec).                                                                                                                                                                                                                                                                                                                                                                                             |
| Log redaction     | PINs plus session tokens never logged                                                                                               | Guest secrets must never reach log storage.                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Observability     | Structured console logs                                                                                                             | Enough signal for the thin loop with no new vendor (basis: structured logging from day one, defer heavier tools until measured pain).                                                                                                                                                                                                                                                                                                                                                    |
| Payments V1.1     | Record only, Xendit deferred to V1.2                                                                                                | A yes creates a payment row marked paid, no money moves yet, keeps V1.1 shippable (basis: your scope agreement, V1.1 records the guest choice).                                                                                                                                                                                                                                                                                                                                          |

## Configuration required

- `DATABASE_URL`: Postgres connection string Prisma connects with (the local compose service in dev and in prod)
- `BETTER_AUTH_SECRET`: secret used to sign staff sessions
- `BETTER_AUTH_URL`: public app URL so auth callbacks resolve correctly

## Library permissions

Log for working agreement 1 (every outside download needs your prior approval):

- `prisma` plus `@prisma/client` pinned to 7.x: requested to back all data access. Approved by you through the agreed stack and this spec walk. Never follow `latest` while the 8 release candidate is current.
- `better-auth`: requested for staff identity and sessions. Approved by you through the same path.
- `lru-cache` v11: requested for free PIN retry limiting. Approved by you through the same path.
- Agent skills into `.agents` only (Prisma, BetterAuth, Next.js, Tailwind): you picked these and set the folder rule. Installed, nothing global, nothing outside `.agents`.
- MCP servers: you chose Skip for now. Prisma MCP plus Postgres MCP stay in Follow-up.

## Planned feature workflow

Drawn for working agreement 2 (every feature ships with its workflow, GA tier on feature 1):

Plan, build with `/develop`, prove with `/check verify` (app boots in docker and passes build), cover with `/test`, review with a fresh model `/check review`, note with `/document`. Spec status moves Proposed to In Progress to Accepted as the scope row moves. `/develop` updates this plan to match what was actually built.

## Consequences

**Positive**:

- One deployable unit the team can run, debug, and reason about on any day
- Relational constraints protect money adjacent rows (folio lines, payment rows) from day one
- Rooms keep live traffic scoped, no order leaks across stays
- Zero paid vendors in V1.1

**Negative / tradeoffs**:

- The custom `server.ts` entrypoint forfeits the minimal standalone server and the zero ops serverless path, you operate the Node server yourself
- socket.io rooms live in server memory, scaling past one instance later needs sticky sessions or an adapter
- LRU limits live in server memory too, a restart clears counters and a second instance would not share them
- Prisma 8 is on the horizon, the 7.x pin needs a deliberate upgrade later
- BetterAuth owns session tables, later auth specs must reuse them, not reinvent

**Neutral**:

- Guest PIN hashing and lockout counters are not decided here, they belong to the data model spec
- `server.js` from standalone output must never become the Docker entrypoint while socket.io rides along
- Polling or SSE was considered and rejected: events flow both ways and the socket demo already runs
- Accepted risk: a server restart clears in memory lockout counters, Postgres stays the durable truth
- Accepted reality: you own the Node process lifecycle now (graceful shutdown, socket reconnect backoff)

## Follow-up

- [ ] Data model spec must define PIN hashing, lockout counters, and session table reuse before Slice 1 builds
- [ ] Reconsider Prisma MCP and Postgres MCP when live database debugging starts (you skipped servers for now)
- [ ] Installed skill conventions are not yet in root `AGENTS.md`. Framework, ORM, and styling conventions apply to every file and belong at root level. Owned by `/sync` or `/audit`; this skill does not edit context files
- [ ] Revisit standalone versus custom server only if socket.io ever leaves the picture
- [ ] Scaffold must settle: base image plus Node version, `prisma generate` plus `migrate deploy` on boot, Prisma 7 generator plus client output location, non root user, `.env.example` owner

## Rationale

Reasoning and options: see rationale.md.
