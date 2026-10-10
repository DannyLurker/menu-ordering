# 0003. Design system and UI foundation: rationale

## Context

Every screen in the hotel menu ordering app (guest ordering on phones, the kitchen board at a distance, staff screens later) needs one visual language. Today the repo holds only scaffold demo pages with default styling, so each coming slice would invent its own reds, buttons, and focus behavior. The scope fixes the direction (the Biz Hotel Batam logo as color reference, strong red on white, modern and clean, English plus Indonesian) and the done state (tokens for type plus color plus spacing plus components, base parts handling focus and keyboard use). Without a decided system, accessibility becomes retrofit and the brand drifts per screen. The stack is already fixed (Next.js 16, React 19, Tailwind v4), so this decision is about the token format, the component source, icons, and type, not the framework.

## Options considered

### Option 1: shadcn parts on Tailwind v4 semantic tokens with Lucide icons

Owned component source copied into the repo, semantic tokens in the v4 theme, Lucide icons by direct import, single light theme, system type stack.

**Pros**:

- Owned source can be edited freely with no sealed dependency dictating the look.
- Semantic tokens let registry parts drop in cleanly and keep brand changes in one file.
- Small approved dependency set with tree shaken icons.

**Cons**:

- Install weight plus a new ownership habit (edited copies, never mass updated).
- shadcn CLI plus registry conventions to learn.

### Option 2: Hand rolled parts with inline SVG icons

Bespoke Tailwind components plus a hand drawn icon set, zero new downloads.

**Pros**:

- No dependencies at all and full control of every stroke.
- Smallest possible install footprint.

**Cons**:

- Every accessibility behavior (focus trap, dialog, keyboard) hand built and hand tested.
- Icon set grows by hand drawing, slow the moment screens need many icons.

### Option 3: Full styled component kit

An adopted kit used whole with its own theme.

**Pros**:

- Fastest start with many parts on day one.

**Cons**:

- Brand mismatch against the hotel red with override fights across the kit.
- Heaviest dependency with a look owned by someone else.

## Rationale

You chose the logo as the color reference and a clean modern look, which wants tokens first and parts that accept them, so Option 1 fits directly: semantic tokens carry the brand while shadcn parts consume them through default class contracts. Option 2 keeps the tree smallest but rebuilds accessible dialog and focus behavior the primitives already prove, a poor trade for a team shipping many screens. Option 3 starts fastest and clashes longest, with brand overrides scattered per component. The single light theme and system stack keep day one small; tokens are shaped so a later dark theme or brand font lands without part changes.
