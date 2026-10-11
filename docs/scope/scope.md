# Scope: Biz Hotel Batam Menu Ordering

Hotel menu ordering for checked in guests, with live kitchen flow from order to served. It serves guests who order from the room, kitchen staff who prepare, and front desk plus admin who manage stays and menu.

**Build approach:** Tracer Bullet (prove the whole pipe works first with one thin real loop, then thicken it).
**Workflow:** GA (after develop, check verify, then test, then fresh model check review, then document). The project default level of rigor. `/architect` is the recommended first stop for a feature with a real decision, but skippable when you already know the build. Any feature can carry its own tag (for example a lighter tier) to do more or less.

_These are recommendations to keep your build orderly, not requirements. Skip anything that does not fit: if you already know how to build a feature, use `/develop` and skip `/architect`. You decide when a feature is `done`._

## Working agreements (requested for this project)

1. Every time the system needs an outside library, ask you for permission before downloading it. Record the request and your answer in the spec or the build log.
2. Every feature ships with a feature workflow. The workflow shows the steps, the checks, and the status changes in plain words, based on the flowcharts you provided. `/architect` draws the planned workflow in the spec, `/develop` updates it to match what was built.
3. Only use .agents folder for agent skills and agent configuration. Never install to global or other agent folders.
4. Every features ships with a step by step how does the feature work. Etc: "Login Feature", 1. User input their identity and submit it, 2. System finds it on database and validate its password, and so on.
5. Every time an outside library exists that is peer reviewed and validated for a job at hand, surface it as an option with a recommendation and let you choose before hand rolling the same thing. Never silently hand roll what a vetted library already does.

## Agreed stack and design (your choices, recorded)

Agreed stack for V1.1: Nextjs with TS, Prisma 7 with Postgresql, BetterAuth, socket.io, docker, LRU cache for free rate limiting. Outside payment uses Xendit in V1.2 only. V1.1 payment only records the guest choice.

Design direction: use the Biz Hotel Batam logo as the color reference (strong red on white, clean type). Keep every screen modern and clean. Full design tokens live in the design system spec.

Language: English plus Indonesian on guest and staff screens.

Hashing direction (your choice, decided in spec 0005): bcryptjs does the app side secret hashing instead of the hand rolled scrypt in `features/stay-session/pin.ts`. Staff passwords stay with BetterAuth built in hashing. Constraint: rows already stored as scrypt keep verifying through lazy rehash on first match. Build it with `/develop` whenever ready; per working agreement 1 the bcryptjs download still needs your yes at build time.

## Folder structure (your guideline, recorded)

New feature code follows four layers, adapted from your example to this repo root layout (no `src/` move; `app/` stays the router). Route handlers stay thin pass throughs, business logic lives in its feature slice, shared code stays generic.

```text
my-app/
├── app/                         # 1. Routing layer (HTTP pass throughs only)
│   ├── (auth)/
│   ├── (guest)/
│   ├── api/                     # Route handlers / controllers
│   │   └── stay/
│   │       └── session/
│   │           └── route.ts
│   ├── layout.tsx
│   └── page.tsx
│
├── features/                    # 2. Domain slices (orthogonal units)
│   ├── stay-session/            # Feature A
│   │   ├── components/          # UI components (pin-form.tsx)
│   │   ├── hooks/               # React hooks (use-stay-session.ts)
│   │   ├── repositories/        # Data access (Prisma / DB queries)
│   │   ├── services/            # Pure business logic (uses repositories)
│   │   ├── types/               # Feature types and schemas
│   │   └── index.ts             # Public API boundary for this feature
│   │
│   └── orders/                  # Feature B (isolated from Feature A)
│       ├── components/
│       ├── repositories/        # Order and menu item DB queries
│       ├── services/            # Order calculation and validation
│       └── index.ts
│
├── components/ui/               # 3a. Shared generic UI (design system parts)
├── lib/                         # 3b. Shared cross cutting code
│   ├── db.ts                    # Global instances (Prisma client, BetterAuth)
│   └── utils.ts
│
├── prisma/                      # Schema, migrations, seed
├── scripts/                     # Prove and ops scripts (prove-*.ts)
│   ├── prove-auth-and-roles.ts
│   └── prove-data-model.ts
│
├── tsconfig.json
└── package.json
```

Layer rules every slice follows:

1. `app/` routes and route handlers only parse input, call one feature service, and shape the response. No SQL and no business rules here.
2. `features/<name>/` owns its domain end to end. Services hold the rules, repositories hold the queries, and only `index.ts` is imported from outside the slice.
3. `components/ui/` plus `lib/` stay generic. Nothing domain specific moves in; a second feature needing it is the signal to promote.
4. Tests live beside the source they cover (`*.test.ts`, vitest), not in a separate tests tree. Prove scripts live in `scripts/`.
5. The Prisma instance is passed down, never imported deep inside. Route handlers take it from `lib/db.ts` and hand it to services, services hand it to repositories. Reason: tests can hand a mock instance instead, so service and repository tests run with no database.
6. Zod validates every request body and query string at the route boundary. Handlers parse with a schema first and answer 400 or 422 on failure; services receive typed values and never revalidate shapes.
7. Within each domain slice under src/features/[feature-name]/, files MUST follow a dot-delimited layer suffix naming convention matching the feature name: [feature-name].layer.ts

Grandfather note: the staff and stay session slices already moved out of `lib/` into `features/`. Rule 5 is adopted: repositories take `db: PrismaClient` as the first argument and import only the type, services take `db` first and hand it to repositories, and every route handler imports `prisma` from `lib/db.ts` and passes it in. Tests hand the instance (real or mock) instead of the slices importing it. `lib/auth.ts` keeps the shared instance for the BetterAuth adapter, and `staff.auth.ts` gates stay session based with no Prisma of their own.

## At a glance

| #   | Feature                                | Phase      | Status  |
| --- | -------------------------------------- | ---------- | ------- |
| 1   | Stack and architecture                 | Foundation | done    |
| 2   | Data model                             | Foundation | done    |
| 3   | Design system and UI foundation        | Foundation | done    |
| 4   | Auth and roles                         | Foundation | done    |
| 5   | Real time foundation and rate limiting | Foundation | done    |
| 6   | Stay and guest check in                | Slice 1    | planned |
| 7   | Guest order with PIN verify            | Slice 1    | planned |
| 8   | Kitchen live board with verify and ETA | Slice 1    | planned |
| 9   | Folio and room charge                  | Slice 2    | planned |
| 10  | Pay now record                         | Slice 2    | planned |
| 11  | Guest live order status                | Slice 2    | planned |
| 12  | Staff menu management                  | Slice 2    | planned |
| 13  | Order history and stay folio view      | Slice 3    | planned |
| 14  | Localization EN plus ID                | Slice 3    | planned |
| 15  | Xendit external payment                | Deferred   | planned |
| 16  | PIN hashing on bcryptjs                | Foundation | done    |
| 17  | Staff passwords on bcryptjs API        | Foundation | done    |

## Foundations

### 1. Stack and architecture · done

Runnable scaffold plus recorded choices so later slices stand on real structure. Code today is a demo socket chat only.
**Done when:** the agreed stack runs locally in docker, the empty app boots and passes build, and the stack choice is recorded in a spec.

- [x] Decide the stack (spec): `/architect stack & architecture`
- [x] Scaffold from the decision: `/develop stack and architecture`
      Spec [0001](../specs/0001-stack-and-architecture/index.md) · Code in `./`, `server.ts`, `app/page.tsx`, `docker-compose.yml`, `Dockerfile`, `prisma/`

### 2. Data model · done

Core tables every slice builds on: guests, stays with dates, secret 6 digit PIN, menu, orders with full status set, folio plus folio lines, payment rows, ETA minutes.
**Done when:** entities and links support the full order loop plus folio without a breaking change later.

- [x] Design it (spec): `/architect data model`
      Spec [0002](../specs/0002-data-model/index.md) · Code in `prisma/schema.prisma`, `lib/db.ts`, `lib/pin.ts`, `prisma/seed.ts`, `scripts/prove-data-model.ts`
- [x] Build it: `/develop data model`
  - [x] Core migration with Stay plus menu plus orders (AC-1, AC-2, AC-3, AC-5, AC-6, AC-7)
  - [x] Folio plus payment extension with verify rule (AC-4, AC-8, AC-9)
  - [x] Seed plus scripted loop proof (AC-1 to AC-9)
- [x] Verify it: `/check verify data model`
- [x] Test it: `/test data model`
- [x] Review it (fresh model): `/check review data model`
- [x] Document it: `/document data model`

### 3. Design system and UI foundation · done

Visual language from the Biz Hotel Batam red and white reference, layout primitives, base components, modern and clean look for guest plus kitchen plus staff.
**Done when:** design tokens cover type plus color plus spacing plus components, and base components handle focus and keyboard use.

- [x] Design it (spec): `/architect design system & UI foundation`
      Spec [0003](../specs/0003-design-system-ui-foundation/index.md) · Code in `app/globals.css`, `components/ui/`, `lib/utils.ts`, `app/ui-preview/`
- [x] Build it: `/develop design system & UI foundation`
  - [x] Token layer with sampled brand red plus system type stack (AC-1, AC-4)
  - [x] Thin thread with Button on the preview route (AC-1, AC-2)
  - [x] Remaining parts plus layout primitives plus glance scale (AC-2, AC-3, AC-5, AC-6)
  - [x] Icons plus contrast and keyboard audit (AC-3, AC-4, AC-7)
- [x] Verify it: `/check verify design system & UI foundation`
- [x] Test it: `/test design system & UI foundation`
- [x] Review it (fresh model): `/check review design system & UI foundation`
- [x] Document it: `/document design system & UI foundation`

### 4. Auth and roles · done

Staff access by role (front desk, kitchen, admin) plus guest identity tied to stay and secret PIN.
**Done when:** each role can reach only its own screens, and guest identity resolves to one stay.

- [x] Design it (spec): `/architect auth and roles`
      Spec [0004](../specs/0004-auth-and-roles/index.md) · Code in `prisma/schema.prisma`, `prisma/migrations/20261011013208_auth_and_roles/`, `features/staff/`, `features/stay-session/`, `lib/` (db, utils, rate limit, api errors), `proxy.ts`, `app/sign-in/`, `app/change-password/`, `app/stays/`, `app/kitchen/`, `app/staff/`, `app/menu/`, `app/api/auth/`, `app/api/stay-session/`, `app/api/staff/`, `app/api/stays/`, `prisma/seed.ts`, `scripts/prove-auth-and-roles.ts`
- [x] Build it: `/develop auth and roles`
  - [x] Migration plus BetterAuth wiring with additive User columns and StaySession (AC-1, AC-2, AC-3, AC-5)
  - [x] Staff sign in plus temp change plus edge gates per role (AC-1, AC-2, AC-4, AC-8)
  - [x] Stay mint plus revoke plus LRU limits and lockout (AC-3, AC-4, AC-5, AC-6, AC-7)
  - [x] Admin create plus seed plus unlock plus prove walk (AC-2, AC-8, AC-1 to AC-8)
- [x] Verify it: `/check verify auth and roles`
- [x] Test it: `/test auth and roles`
- [x] Review it (fresh model): `/check review auth and roles`
- [x] Document it: `/document auth and roles`

### 5. Real time foundation and rate limiting · done

Shared live channel plan plus free rate limiting with LRU cache, so order events and PIN retry limits behave the same everywhere.
**Done when:** order created plus status changed events reach the right room live, and PIN retries are limited and logged.

- [x] Design it (spec): `/architect real time foundation and rate limiting`
      Spec [0007](../specs/0007-realtime-foundation-rate-limiting/index.md) · Code in `server.ts`, `lib/realtime.ts`, `lib/realtime-server.ts`, `lib/realtime-client.ts`, `lib/rate-limit.ts`, `scripts/prove-realtime.ts`
- [x] Build it: `/develop real time foundation and rate limiting`
  - [x] Live rooms plus emit plus client join (AC-1, AC-2, AC-3, AC-4, AC-5)
  - [x] Shared LRU limits plus 429 shape (AC-6, AC-7)
  - [x] Proof walk plus redaction plus docs (AC-1 to AC-8)
- [x] Verify it: `/check verify real time foundation and rate limiting`
- [x] Test it: `/test real time foundation and rate limiting`
- [x] Review it (fresh model): `/check review real time foundation and rate limiting`
- [x] Document it: `/document real time foundation and rate limiting`

### 16. PIN hashing on bcryptjs · done

Guest PINs hash with the peer reviewed bcryptjs library instead of hand rolled scrypt, with old scrypt rows upgrading lazily on first successful verify.
**Done when:** new PINs store as bcrypt rows, old scrypt rows still verify and then upgrade, and the auth prove walk passes unchanged.

- [x] Design it (spec): `/architect hashing: bcryptjs for PINs with scrypt compat`
      Spec [0005](../specs/0005-pin-hashing-bcrypt/index.md) · Code in `features/stay-session/pin.ts`, `features/stay-session/pin.test.ts`, `features/stay-session/services/stay-session.service.ts`, `features/stay-session/repositories/stay-session.repository.ts`, `prisma/seed.ts`, `scripts/prove-auth-and-roles.ts`, `scripts/prove-data-model.ts`
- [x] Build it: `/develop pin hashing on bcryptjs`
  - [x] Hasher plus dual verify on bcryptjs (AC-1, AC-2, AC-5, AC-6)
  - [x] Lazy rehash plus callers plus gates (AC-3, AC-4)
- [x] Verify it: `/check verify pin hashing on bcryptjs`
- [x] Test it: `/test pin hashing on bcryptjs`
- [x] Review it (fresh model): `/check review pin hashing on bcryptjs`
- [x] Document it: `/document pin hashing on bcryptjs`

### 17. Staff passwords on bcryptjs API · done

Staff password hashing moves to bcryptjs inside the BetterAuth config, and every account write goes through the BetterAuth API seams instead of direct database calls.
**Done when:** created and reissued staff sign in against bcrypt rows, and the auth prove walk passes unchanged.

- [x] Design it (spec): `/architect staff password hashing: bcryptjs with BetterAuth verify compat`
      Spec [0006](../specs/0006-staff-passwords-bcrypt-api/index.md) · Code in `lib/auth.ts`, `features/staff/services/staff.service.ts`, `features/staff/repositories/staff.repository.ts`, `prisma/seed.ts`, `scripts/prove-auth-and-roles.ts`
- [x] Build it: `/develop staff passwords on bcryptjs API`
  - [x] Bcrypt hasher in BetterAuth config (AC-1)
  - [x] Creation plus reissue plus seed through seams, direct writes retired (AC-1, AC-2, AC-3, AC-5)
  - [x] Gates: typecheck plus lint plus build plus prove unchanged (AC-4)
- [x] Verify it: `/check verify staff passwords on bcryptjs API`
- [x] Test it: `/test staff passwords on bcryptjs API`
- [x] Review it (fresh model): `/check review staff passwords on bcryptjs API`
- [x] Document it: `/document staff passwords on bcryptjs API`

## Slice 1: Core order loop (the walking skeleton)

### 6. Stay and guest check in · needs a decision

Front desk creates the guest account at check in. Guest sets the secret 6 digit PIN. Workflow: create stay, set PIN, validate stay dates on every order.
**Done when:** staff can check a guest in, the guest can set a PIN, and an expired stay cannot order.

- [ ] Design it (spec): `/architect stay and guest check in`

### 7. Guest order with PIN verify · needs a decision

Guest picks items and places an order, then enters the PIN. Workflow: create order draft, check stay dates, verify PIN, reject and ask again on mismatch, lock with call staff message when the rate limit trips.
**Done when:** a checked in guest can order with a correct PIN, a wrong PIN asks again, and repeated misses lock with a call staff message.

- [ ] Design it (spec): `/architect guest order with PIN verify`

### 8. Kitchen live board with verify and ETA · needs a decision

New orders appear at once on the kitchen board. Kitchen verifies PENDING into PREPARING and enters estimated minutes. Full status set: PENDING, PREPARING, READY, SERVED, GUEST_CANCELLED, KITCHEN_CANCELLED. Workflow: notify, show, verify with ETA, advance status.
**Done when:** a new order shows live without refresh, verify sets PREPARING with ETA, and every later status change persists.

- [ ] Design it (spec): `/architect kitchen live board with verify and ETA`

## Slice 2: Folio and payment record

### 9. Folio and room charge · needs a decision

Folio plus folio lines are created when kitchen verifies. A guest who declines pay now keeps the charge on the room folio for checkout. Workflow: verify, create folio lines, keep unpaid balance on folio.
**Done when:** every verified order has folio lines, and unpaid orders stay payable at checkout.

- [ ] Design it (spec): `/architect folio and room charge`

### 10. Pay now record · needs a decision

Guest is asked after verify whether to pay now with e wallet. On yes for V1.1, the app records a payment row as already paid with no real money movement. Workflow: ask, on yes create payment row, on no keep room charge.
**Done when:** a yes creates a payment row linked to the order and folio, and a no leaves the room charge intact.

- [ ] Design it (spec): `/architect pay now record`

### 11. Guest live order status · needs a decision

Guest sees order status plus ETA live with no refresh, from PREPARING through SERVED or cancelled.
**Done when:** status and ETA update live on the guest screen with empty and error states covered.

- [ ] Design it (spec): `/architect guest live order status`

### 12. Staff menu management · needs a decision

Staff manages categories, items, prices, and availability. Kitchen sees availability live.
**Done when:** staff can add plus edit plus hide items, and hidden items cannot be ordered.

- [ ] Design it (spec): `/architect staff menu management`

## Slice 3: V1.1 polish

### 13. Order history and stay folio view · needs a decision

Guest sees own orders and folio balance. Staff sees the stay folio at checkout.
**Done when:** guest and staff each see the same totals for the stay, with paid and unpaid clearly shown.

- [ ] Design it (spec): `/architect order history and stay folio view`

### 14. Localization EN plus ID · needs a decision

All guest and staff screens read well in English and Indonesian.
**Done when:** every screen in Slice 1 and Slice 2 switches language with no missing strings.

- [ ] Design it (spec): `/architect localization EN plus ID`

## Deferred

Out of scope for the current build pass, kept so the plan stays honest.

- **Xendit external payment**: real e wallet money movement in V1.2, replaces the V1.1 record only step · needs a decision
- **Dark theme**: full dark token set if ever wanted, needs its own spec (from spec 0003) · needs a decision
- **Checkout settlement**: settle folio balance at checkout with receipts · needs a decision
- **Realtime multi host** (from spec 0007): shared pub sub plus shared limiter when a second host is real; V1.1 stays single instance · needs a decision
- **Product analytics**: measure orders, prep times, and conversion · needs a decision

## Legend

**The decision box.** Every feature carries exactly one, the sub task whose label ends with `(spec)`. Its wording varies (`Design it (spec)` normally, `Decide the stack (spec)` on Stack & architecture), so skills locate it by that `(spec)` suffix, never by an exact label. Every other box is an execution box and `/architect` never ticks one.

**Feature lifecycle**: the scope updates as a feature moves; each row is what it shows and who sets it:

| State                        | Set by                                                                                 | The feature shows                                                                                                                                                                                                                            |
| ---------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `planned` · needs a decision | `/scope`                                                                               | one box: `Design it (spec): /architect <feature>`                                                                                                                                                                                            |
| `in-progress` (designed)     | **`/architect` at spec capture**                                                       | `Design it` ticked; spec linked; `Build it: /develop <feature>` + **2 to 5 milestones**; the tier's closing boxes (`Verify it` Alpha+, `Test it` Beta+, `Review it` + `Document it` GA); any surfaced follow up enrolled                     |
| `in-progress` (building)     | `/develop`                                                                             | milestone sub boxes tick one by one; code pointer filled                                                                                                                                                                                     |
| `in-progress` (verified)     | `/check verify`                                                                        | `Build it` + milestones ticked; `Verify it` ticked                                                                                                                                                                                           |
| `done`                       | **you, when you decide it is** (any skill sets it when you say so); `/sync` reconciles | boxes you ran ticked, skipped ones marked skipped; the tier's last stage (`Prototype` → after `/develop`; `Alpha` → after `/check verify`; `Beta`/`GA` → after `/test`) is the suggested point to call it done; `/sync` captures conventions |

- **Next step** = the first unticked box (always a command or a tracked milestone).
- **needs a decision** = run `/architect` first; otherwise straight to `/develop` (or `/audit` for standards & tooling). The tag drops once the spec is captured.
- **Atomic build tasks live in the spec's `## Build plan`, not here**: the scope carries only the milestone rollup.
- **Status** `planned` → `in-progress` → `done`, plus `existing` (pre workflow) and `dropped` (de scoped, kept for history).
- **Approach tag** beside a heading overrides the project default for that feature; no tag = inherits it.
- **Workflow tier tag** beside a heading sets that one feature's rigor above or below the project default; no tag inherits the default. It decides the feature's check boxes and each skill's next suggestion.
- **Workflow** (header line) is the project default, what runs after `/develop`: **Prototype** = nothing (trust develop's own build time self check); **Alpha** = `/check verify`; **Beta** = `/check verify` then `/test`; **GA** = adds a fresh model `/check review` then `/document`. A feature built on an unratified decision (an `Assumed` spec) stays flagged, but that never blocks `done`.
- **Pointer line** (`spec <n> · code in <path>`): the spec link added by `/architect`, the code path by `/develop`.
