---
name: shadcn-composition-and-trigger-patterns
description: Use when composing shadcn components into real product surfaces instead of treating them like isolated snippets. Covers `asChild`, trigger ownership, dialog and dropdown composition, local wrappers, and the rule that the value is in stable composition patterns, not in blindly stacking primitives.
---

# shadcn Composition And Trigger Patterns

Use this skill when the task is mostly about composing shadcn primitives into stable UI behavior.

## Scope

- `asChild` usage
- trigger ownership and composability
- dialog, dropdown, sheet, popover, and command-surface composition
- local wrappers and boundaries
- avoiding wrapper sprawl and prop soup

## Routing cues

- `asChild`, trigger composition, dialog triggers, dropdown menu actions, command surfaces, local wrappers, Radix composition behavior, or deciding how to own a reusable product surface -> use this skill
- if the problem is really theme tokens or dark mode -> use `shadcn-theming-tokens-and-dark-mode`
- if the problem is really field structure and validation flows -> use `shadcn-forms-and-field-primitives`

## Default path

1. Start from the copied component code and compose behavior locally.
2. Use `asChild` when the trigger or interactive wrapper must preserve the existing element contract.
3. Keep open state local unless multiple siblings truly need coordination.
4. Extract a local product wrapper only after the interaction pattern repeats.
5. Prefer a few stable composition patterns over a large library of speculative wrappers.

## When to deviate

- Lift state only when coordination or controlled behavior is clearly needed.
- Build a stronger wrapper when repeated product usage needs one shared semantic contract.
- Skip `asChild` when the default trigger element is already the right contract.

## Guardrails

- preserve semantics when composing triggers
- do not hide simple component usage behind unnecessary wrappers
- keep interaction ownership close to the surface that actually needs it
- treat copied shadcn code as editable when behavior or accessibility needs adjustment

## Avoid

- wrapping every component immediately for “future flexibility”
- stacking several interactive wrappers without thinking through focus and semantics
- using `asChild` mechanically when the default trigger is already correct
- creating giant prop bags to drive what should be small local composition decisions

## Verification checklist

- trigger semantics remain correct after composition
- `asChild` is used deliberately, not automatically
- state ownership is local unless coordination requires lifting it
- wrappers exist only where repetition or semantics justify them
- the final API is smaller and clearer than the raw ad hoc composition it replaces

## Quick example

```tsx
<Dialog>
  <DialogTrigger asChild>
    <Button variant="outline">Open</Button>
  </DialogTrigger>
  <DialogContent>{/* ... */}</DialogContent>
</Dialog>
```

## Current snapshot

- Checked against official docs on 2026-04-03
- Current npm line verified live on 2026-04-03: `shadcn@4.1.2`
- Docs in scope: component patterns across Button, Dialog, Dropdown Menu, Sheet, and related Radix-backed composition

## Official references

- https://ui.shadcn.com/docs/components/button
- https://ui.shadcn.com/docs/components/dialog
- https://ui.shadcn.com/docs/components/dropdown-menu
- https://ui.shadcn.com/docs/components/sheet

## References

- [Composition defaults and wrapper boundaries](./references/composition-defaults-and-wrapper-boundaries.md)
