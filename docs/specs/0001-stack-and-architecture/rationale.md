# 0001. Stack and architecture: rationale

## Context

> Premise note: this topic spans the whole foundation (stack, data model, auth roles, live channels, design tokens). This spec records the stack choice only. Data model, auth and roles, real time foundation, and design system each get their own spec, and every one of them builds on this decision.

Biz Hotel Batam needs a menu ordering loop for checked in guests: order from the room, kitchen verifies with an ETA, folio carries the charge, payment choice recorded. Three user groups (guests, kitchen, front desk plus admin) share one live flow from order to served. The tracer bullet approach needs a runnable skeleton first, one thin real loop through every layer, then thickening.

Forces shaping the call: a small team operating one hotel property, so operational simplicity beats architectural ambition. A demo socket chat already runs on Next.js with a custom server, so the stack should reuse it, not replace it. V1.1 must stay free of paid vendors with real money movement deferred. PIN secured ordering plus stay scoped data means the store must enforce relations, not just hold documents.

## Options considered

### Option A: Next.js monolith with Prisma, BetterAuth, socket.io, Docker

One Next.js TypeScript server renders screens, serves REST route handlers, and hosts socket.io rooms. Prisma 7 maps to PostgreSQL in Docker Compose. BetterAuth keeps staff sessions in the same database. LRU cache limits PIN retries in server memory.

**Pros**:
- Single deployable unit, smallest operational surface for a small team
- Reuses the running demo instead of rewriting it
- Relational guarantees for folio and payment rows from day one
- Zero paid vendors in V1.1

**Cons**:
- Custom server entrypoint, you operate Node yourself and lose the serverless path
- In memory rooms plus counters do not span a second instance later

### Option B: Serverless hosting with managed database, hosted auth, hosted realtime

Next.js on a serverless platform, serverless Postgres, hosted sign in, hosted push channels for live updates.

**Pros**:
- Zero server operation, managed services absorb backups and scaling
- Hosted auth removes session code from the codebase

**Cons**:
- Custom socket server needs rework, serverless functions hold no persistent connections
- Three outside vendors plus metered bills from day one for a single hotel load
- Guest and order data spreads across vendors, harder to reason about at 2am

### Option C: All in one backend platform

One vendor for Postgres, auth, and realtime channels, Next.js as a thin client.

**Pros**:
- One dashboard, one bill, realtime included without socket code
- Auth plus row policies out of the box

**Cons**:
- Auth and realtime you would only half use, the agreed design needs stay plus PIN identity and scoped kitchen rooms anyway
- Vendor shaped data model, migration pain if the hotel ever self hosts
- Realtime semantics differ from the socket rooms already proven in the demo

### Option D: Bare Node with raw SQL, hand rolled sessions, raw sockets

No framework upgrades, no ORM, no auth library: plain Node server, direct SQL driver, own session tables, native socket handling.

**Pros**:
- Fewest dependencies, every line owned by the team

**Cons**:
- Hand built auth plus session handling repeats the hardest mistakes in the industry (expiry, rotation, fixation, storage)
- Raw SQL for all CRUD plus raw reconnect logic burns Slice 1 time on plumbing, not the order loop
- No conventions for later contributors to follow

## Rationale

The property scale plus team size point at a monolith (basis: monolith first for a small team, boring technology wins). The domain is relational (stays own orders, orders own folio lines, folio lines own payment rows), so a relational store with an ORM for CRUD is the default, not a fashion pick (basis: relational database as the default, ORM for CRUD with SQL kept for reporting). Auth from a proven library and live rooms over the already running socket server remove the two riskiest custom builds from Slice 1. Docker Compose makes prod reproducible without a platform team. Option B pays for scale that does not exist, Option C bends the model around a vendor, Option D rebuilds solved problems by hand.

## Landscape scan

Checked 2026-10-10 against the npm registry plus Next 16.4 docs, capped and read only:

- Prisma 7 is the current stable line (`@prisma/client` 7.10.0 seen). The `prisma` CLI latest tag already points at an 8 release candidate, so pin 7.x and never follow `latest`.
- BetterAuth 1.7.7 is current with peers covering Next 14 through 16, React 18 plus 19, and Prisma clients 5 through 7. Fits this stack exactly.
- socket.io 4.8.x is current and matches the demo. Standing caveat, unchanged: a custom server works but forfeits minimal standalone output and serverless deploys.
- Next 16.4 docs (updated 2026-09-18) still document Docker with standalone output. Conflict noted: Dockerfile must start `server.ts`, not the emitted `server.js`, while socket.io rides along.
- `lru-cache` v11 is current. Single instance only, not shared across replicas.
- Nothing in the agreed stack is stale. One watch item: Prisma 8 on the horizon, BetterAuth peers stop at client 7.

## References

**Project sources** (verifiable, in this repo):
- `docs/scope/scope.md`, the agreed stack for V1.1 plus the GA workflow plus working agreements 1 through 3
- `server.ts` plus `app/page.tsx`, the running demo socket chat this stack reuses
- `package.json`, Next 16.4 plus React 19 plus socket.io 4.8 already installed
- Installed skills in `.agents/skills/`: `vercel-react-best-practices`, `nextjs-app-router-patterns`, `tailwind-design-system`, `prisma-client-api`, `prisma-orm-setup`, `better-auth-best-practices`

**Practices & standards**:
- Monolith first for a small team
- Boring technology over novelty
- Relational database as the default for relational data
- Never build auth by hand
- ORM for CRUD, SQL for complexity
- Structured logging from day one
- Ephemeral cache, never a primary store

**Links** (web verified only):
- Next.js output config docs: https://nextjs.org/docs/app/api-reference/config/next-config-js/output
- npm registry metadata verified 2026-10-10: https://registry.npmjs.org/next/latest · https://registry.npmjs.org/@prisma/client/latest · https://registry.npmjs.org/prisma/latest · https://registry.npmjs.org/better-auth/latest · https://registry.npmjs.org/socket.io/latest · https://registry.npmjs.org/lru-cache/latest
