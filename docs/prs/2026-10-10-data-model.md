# feat: add hotel ordering data model with store level guards

## What

Nine Prisma tables covering stays, menu, orders, folio, and payments, plus scrypt PIN helpers, a seed, a scripted proof loop, and 21 tests. A follow up migration enforces the spec invariants in the store with CHECK constraints and partial unique indexes.

## Why

Implements `docs/specs/0002-data-model/index.md`. Every later slice (check in, ordering, kitchen board, folio, pay now record) builds on these tables, so the model lands whole now to avoid a breaking change mid build.

## Changes

- Core schema (`prisma/schema.prisma`): Stay, Guest, MenuCategory, MenuItem, Order, OrderItem, Folio, FolioLine, Payment with the full status sets and snapshot pricing on order lines
- Base migration plus a checks migration: one ACTIVE stay per room, one folio per stay, one folio line per order, one active payment per order, CHECK bounds on dates, prices, quantities, and ETA
- PIN helpers (`lib/pin.ts`): salted scrypt hash, constant time compare, fail closed on malformed input; shared client (`lib/db.ts`) with an explicit error when `DATABASE_URL` is unset
- Seed (2 categories, 5 items, demo stay) and `scripts/prove-data-model.ts`, which walks check in to served to folio to payment and ends PROOF PASS
- Suite (21 tests): PIN semantics, client wiring, and live store guard tests including the voided lines balance path

## How to test / verify

- `pnpm prisma migrate status` shows the schema in sync with no pending migrations
- `pnpm exec vitest run` shows 21 passed
- `pnpm tsx prisma/seed.ts` shows seed ok with no plain PIN in the output, then `pnpm tsx scripts/prove-data-model.ts` ends PROOF PASS
- `pnpm tsc --noEmit` passes with no errors

## Risk & rollout

Two migrations ship here; they apply cleanly on an empty store and were confirmed live via `pg_constraint` and `pg_indexes`. On a store that already holds rows, the new CHECK constraints validate existing data at apply time, so back up before deploying anywhere with real rows. No new env vars. Residual risk accepted from review (`docs/reviews/2026-10-10-master.md`): PIN format rules and retry counting belong to the coming auth slice, and order transition enforcement belongs to Slice 1.

## Notes for reviewers

The review asked for store level enforcement and got it, except two conscious deferrals above. Prisma has no CHECK or partial index support in its schema language, so those guards live in migration SQL with mirror comments in `schema.prisma`, the same pattern as the pre existing Stay partial index.
