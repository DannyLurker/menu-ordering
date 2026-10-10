# 0003. Design system and UI foundation

**Date**: 2026-10-10
**Status**: In Progress

## Summary

This spec sets the single visual language for every screen in the hotel menu ordering app (the screens guests, kitchen, and staff use). You get one token file (color plus type plus spacing plus radius, in plain words the named values every screen draws from) in the strong red of the Biz Hotel Batam logo on white, plus five base parts (button, input, card, badge, dialog) and layout primitives, all usable by keyboard and readable on phones and on the kitchen board. Later slices build screens from these parts instead of inventing their own look.

## Requirements

**User stories**:

- As a guest ordering from my phone, I want every screen to look like one clean app with big readable touch targets so I can order without mistakes.
- As a kitchen staff member glancing at the board from meters away, I want large high contrast status text so I see what needs cooking at once.
- As the engineer building Slice 1, I want tokens plus base parts ready so each screen composes them instead of inventing new styles.

**Acceptance criteria**:

- **AC-1**: One token file defines color plus type plus spacing plus radius, and a preview surface renders the red on white theme with no hardcoded colors outside it.
- **AC-2**: Button plus input plus card plus badge plus dialog plus layout primitives render and compose on a 375px wide phone viewport with no horizontal scroll, checked with an Indonesian copy sample (longer strings than English).
- **AC-3**: Every interactive part shows a visible focus state and is fully operable by keyboard alone (Tab to reach, Enter or Space to act, Escape to close the dialog).
- **AC-4**: Body text contrast meets WCAG 2.2 AA (a public readability standard, normal text needs a 4.5 to 1 ratio); brand red body text is allowed only in combinations the build verifies as passing.
- **AC-5**: Motion honors the reduced motion setting, and every part defines its loading plus empty plus error look.
- **AC-6**: A kitchen glance type scale (status text at least 32px semibold, readable from meters away) sits beside the guest scale in the same token file.
- **AC-7**: Base parts carry no hardcoded user facing copy; labels arrive through props or children so English plus Indonesian strings land later without part changes.

## Decision

**Chosen option**: Option 1: shadcn parts on Tailwind v4 semantic tokens with Lucide icons

You build the system as shadcn style owned source (copied into the repo, edited freely) on Tailwind CSS v4 theme tokens (the version 4 way of naming design values in CSS) with Lucide icons, single light theme, system type stack, mobile first with a kitchen glance scale.

**Implementation skills**: `tailwind-design-system` (`wshobson/agents`, `.agents/skills/tailwind-design-system/`) · `shadcn` (`shadcn-ui/ui`, `.agents/skills/shadcn/`)

## Feature design

**Data model sketch**:

None. This feature persists nothing; tokens are code constants and parts hold no state beyond open or closed UI state owned by each screen.

**Visual direction** (sampled from the uploaded Biz Hotel Batam logo; exact hex confirmed in build task 1):

| Token role | Value                                                        | Use                                                                          |
| ---------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Brand red  | approx `#E1251B`, exact sample owed                          | Fills, primary actions, large text and graphics only, never normal body text |
| Deep red   | darkened brand red, owed                                     | Pressed and hover states, danger fill with white text                        |
| Red text   | darker brand red verified AA against white, owed             | The only red allowed on normal body text                                     |
| Ink        | warm near black, owed                                        | Body text, always AA against paper                                           |
| Paper      | `#FFFFFF`                                                    | Page background                                                              |
| Mist       | light warm gray, owed                                        | Card fills, dividers, input backgrounds                                      |
| Focus ring | 2px brand red with 2px white offset, white ring on red fills | Visible keyboard focus on every part, usable under forced colors             |

Spacing follows the Tailwind default scale untouched. Radius tokens sm 0.25rem, md 0.375rem, lg 0.5rem, xl 0.75rem.

Type: system stack (no download, native look on every device). Replaces the scaffold default Geist faces in `app/layout.tsx`. One Latin family covers English plus Indonesian.

**Component inventory** (day one; PIN pad plus menu card plus ETA display plus language toggle stay with their slices):

| Part       | Key props contract                                                                                                                                   | States                                                              |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Button     | `variant` primary or quiet (transparent, ink text) or danger (deep red fill, white text), `size` guest touch (min 44px target) or kitchen (min 48px) | loading (spinner, keeps width), disabled, focus ring                |
| Input      | `label`, `error`, `hint`, hint plus error exposed via describedby, error message via errormessage when invalid                                       | error, disabled, focus ring                                         |
| Card       | `title` opt, `action` opt                                                                                                                            | plain, raised for menu groups, empty look defined                   |
| Badge      | `tone` neutral or brand or danger or ok                                                                                                              | text only, never the sole carrier of meaning                        |
| Dialog     | `title` plus `description` required and wired via labelledby, focus trap, Escape to close, returns focus to trigger                                  | open, closing fade                                                  |
| Primitives | Container (max width, roomy padding), Stack, Section                                                                                                 | responsive by default, kitchen glance status text min 32px semibold |

Icons: `lucide-react` package, direct named imports (so the bundler ships only used icons), shared defaults size 18 and stroke 1.75 through the provider at the app root, decorative icons hidden from assistive tech, icon only buttons named on the button.

Motion: short fades only (200ms ease-out), disabled under reduced motion. No layout shifting animation.

**How the feature works**:

1. Engineer opens any screen and reaches for tokens plus parts, never raw color values.
2. Guest parts render at phone width first with 44px touch targets and the system type stack.
3. Kitchen surfaces switch to the glance scale for status text while keeping the same tokens.
4. Keyboard users Tab through every part, see the focus ring, and drive the dialog with Enter plus Escape.
5. Later slices pass English plus Indonesian strings through props; parts never change for language.

**API surface**:

No new HTTP routes in this spec. Component contracts above are the interface; later specs own routes.

**Value sourcing**:

| Action           | Value produced or displayed     | Source                                                                                                                                         |
| ---------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Price display    | whole rupiah amount, no cents   | `MenuItem.price` column via Slice 1, decided in spec 0002; no part owns a price display day one                                                |
| Status pill      | order state label               | `Order.status` column via the kitchen slice, decided in spec 0002; the state to tone mapping is owned by the kitchen board spec, see Follow-up |
| ETA display      | prep minutes text               | `Order.etaMinutes` column via the kitchen slice, decided in spec 0002; no part owns it day one                                                 |
| Bilingual labels | English plus Indonesian strings | passed as props by each screen, owned by spec 0014                                                                                             |
| Icon choice      | explicit icon per use           | named import in code, static set                                                                                                               |

**Key invariants**:

- No hardcoded color, font, or spacing values outside the token file.
- Every interactive part reachable and operable by keyboard with a visible focus ring.
- Body text combinations meet WCAG 2.2 AA; unverified red on white body text is forbidden, red body text uses the verified red text token only.
- Base parts hold no user facing copy; all labels arrive via props or children.
- Parts stay usable under forced colors (system high contrast): focus ring and badge meaning must survive it.
- Icons are explicit static imports, never loaded by runtime name.
- Single light theme; no OS dark mode override (the scaffold `prefers-color-scheme` block goes away).

**Security model**:

No regulated data lives in the system itself; parts display guest names plus prices only when later slices pass them. No secrets, no new env vars. The accessibility bar (AC-3, AC-4) is the security analogue here: keyboard operability plus readable contrast on every part.

**Configuration required**:

No new env vars. New packages (approved by you in the design walk, recorded below): `lucide-react`, `clsx`, `tailwind-merge`, `class-variance-authority`, Radix primitives as needed.

**Library permissions**:

Log for working agreement 1 (every outside download needs your prior approval):

- `lucide-react`: requested for the icon set. Approved by you in the design walk.
- `clsx` plus `tailwind-merge` plus `class-variance-authority` plus Radix primitives: requested as shadcn support libs. Approved by you in the design walk.
- shadcn CLI (`shadcn@4.x` line): requested to scaffold owned parts. Approved by you in the design walk through the shadcn choice.

**Critical test scenarios**:

- Happy path: preview surface renders tokens plus all five parts on a phone viewport, verifies **AC-1, AC-2**.
- Failure case: full keyboard walk plus a contrast audit pass, verifies **AC-3, AC-4**.
- Failure case: reduced motion on, every part still communicates loading plus empty plus error, verifies **AC-5**.
- Auth case: none, no regulated data in this spec. Kitchen glance scale read check covers **AC-6**; prop only labels check covers **AC-7**.

## Build plan

Ordered by Tracer Bullet (thin thread first: tokens plus one part on a preview surface, then thicken with the rest).

1. Sample the exact brand red plus supporting values from the uploaded logo and record them, satisfies **AC-1**.
2. Token layer in `app/globals.css` as Tailwind v4 `@theme` semantic tokens, single light theme, scaffold dark block removed, satisfies **AC-1, AC-4**.
3. shadcn init plus `lib/utils.ts` plus Button on a preview route (`/ui-preview`, unlinked from site nav) proving the thread, satisfies **AC-1, AC-2**. If the registry CLI fails at build time, hand build the parts on Radix dialog, slot, and label primitives instead with identical token contracts.
4. Input plus Card plus Badge plus Dialog with focus plus keyboard plus ARIA behavior, satisfies **AC-2, AC-3, AC-5**.
5. Layout primitives plus kitchen glance scale (status min 32px semibold, kitchen touch min 48px) plus the phone width pass with the Indonesian sample, satisfies **AC-2, AC-6**.
6. Lucide wiring with provider defaults plus the decorative versus named icon rules, satisfies **AC-3**.
7. Contrast plus keyboard audit (measured ratios: body 4.5, large text 3.0, non text 3.0), Geist replaced by the system stack, prop only labels check, satisfies **AC-3, AC-4, AC-7**.
8. Prove with build plus preview screenshots (including the Indonesian sample) plus the keyboard walk, satisfies **AC-1 to AC-7**.

## Planned feature workflow

Plan, build with `/develop`, prove with `/check verify` (preview renders, keyboard walk passes, build passes), cover with `/test`, review with a fresh model `/check review`, note with `/document`. Spec status moves Proposed to In Progress to Accepted as the scope row moves. `/develop` updates this plan to match what was actually built.

## Consequences

**Positive**:

- Every later slice composes from one language instead of inventing styles per screen.
- Owned parts can be edited freely; no sealed dependency dictates the look.
- Zero font downloads; system stack is instant and native everywhere.
- Accessibility lands before screens exist, not as retrofit.

**Negative / tradeoffs**:

- shadcn plus Radix plus Lucide add install weight and a new ownership habit (edited copies, not updated packages).
- Single light theme now; a later dark theme touches every token at once.
- The eyed brand red needs exact sampling in task 1 or tokens start slightly off brand.

**Neutral**:

- Demo socket pages keep working untouched; they adopt parts when their slices land.
- Localization strings stay with later specs; parts only promise prop shaped labels.
- Token names follow shadcn semantics (background, primary, muted) so registry parts drop in cleanly.

## Follow-up

- [ ] Exact brand hex sampling from your logo file opens the build (task 1); the approx `#E1251B` above is eyed, not measured.
- [ ] Consider installing the `lucide-react-overview-and-setup` plus `lucide-react-styling-and-accessibility` community skills for icon conventions; the registry installs kept failing in this session, the packages themselves are approved regardless.
- [ ] Order state to badge tone mapping is owned by the kitchen board spec (spec 0008); this spec only promises the tone prop exists.
- [ ] shadcn plus styling conventions are not yet in root `AGENTS.md`. Owned by `/sync` or `/audit`; this skill does not edit context files.
- [ ] Dark theme, if ever wanted, needs its own spec; tokens are shaped to allow it.
- [ ] Library permission log per working agreement 1 lives in this spec under Feature design.

## Rationale

Reasoning and options: see rationale.md.
