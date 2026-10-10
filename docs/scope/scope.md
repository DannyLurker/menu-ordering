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

## Agreed stack and design (your choices, recorded)

Agreed stack for V1.1: Nextjs with TS, Prisma 7 with Postgresql, BetterAuth, socket.io, docker, LRU cache for free rate limiting. Outside payment uses Xendit in V1.2 only. V1.1 payment only records the guest choice.

Design direction: use the Biz Hotel Batam logo as the color reference (strong red on white, clean type). Keep every screen modern and clean. Full design tokens live in the design system spec.

Language: English plus Indonesian on guest and staff screens.

## At a glance

| #   | Feature                                | Phase      | Status      |
| --- | -------------------------------------- | ---------- | ----------- |
| 1   | Stack and architecture                 | Foundation | in-progress |
| 2   | Data model                             | Foundation | in-progress |
| 3   | Design system and UI foundation        | Foundation | in-progress |
| 4   | Auth and roles                         | Foundation | planned     |
| 5   | Real time foundation and rate limiting | Foundation | planned     |
| 6   | Stay and guest check in                | Slice 1    | planned     |
| 7   | Guest order with PIN verify            | Slice 1    | planned     |
| 8   | Kitchen live board with verify and ETA | Slice 1    | planned     |
| 9   | Folio and room charge                  | Slice 2    | planned     |
| 10  | Pay now record                         | Slice 2    | planned     |
| 11  | Guest live order status                | Slice 2    | planned     |
| 12  | Staff menu management                  | Slice 2    | planned     |
| 13  | Order history and stay folio view      | Slice 3    | planned     |
| 14  | Localization EN plus ID                | Slice 3    | planned     |
| 15  | Xendit external payment                | Deferred   | planned     |

## Foundations

### 1. Stack and architecture · in-progress

Runnable scaffold plus recorded choices so later slices stand on real structure. Code today is a demo socket chat only.
**Done when:** the agreed stack runs locally in docker, the empty app boots and passes build, and the stack choice is recorded in a spec.

- [x] Decide the stack (spec): `/architect stack & architecture`
- [x] Scaffold from the decision: `/develop stack and architecture`
      Spec [0001](../specs/0001-stack-and-architecture/index.md) · Code in `./`, `server.ts`, `app/page.tsx`, `docker-compose.yml`, `Dockerfile`, `prisma/`

### 2. Data model · in-progress

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

### 3. Design system and UI foundation · in-progress

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

### 4. Auth and roles · needs a decision

Staff access by role (front desk, kitchen, admin) plus guest identity tied to stay and secret PIN.
**Done when:** each role can reach only its own screens, and guest identity resolves to one stay.

- [ ] Design it (spec): `/architect auth and roles`

### 5. Real time foundation and rate limiting · needs a decision

Shared live channel plan plus free rate limiting with LRU cache, so order events and PIN retry limits behave the same everywhere.
**Done when:** order created plus status changed events reach the right room live, and PIN retries are limited and logged.

- [ ] Design it (spec): `/architect real time foundation and rate limiting`

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
