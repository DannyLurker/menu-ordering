---
name: shadcn-forms-and-field-primitives
description: Use when building forms with shadcn in a way that stays opinionated instead of devolving into copied snippets. Covers field primitives, choosing one form-state strategy, integrating validation, and keeping complex stateful form logic out of the visual component layer.
---

# shadcn Forms And Field Primitives

Use this skill when the task is about form UI structure, not when it is purely about a form-state library in isolation.

## Scope

- field primitives and form presentation
- choosing a form-state strategy
- keeping validation and UI responsibilities separate
- integrating shadcn fields with `react-hook-form` or another chosen form-state layer
- deciding when the problem is really form-state orchestration rather than field presentation

## Routing cues

- shadcn forms, field primitives, `react-hook-form`, `Controller`, `Field`, form layout, input validation presentation, error text, helper text, or deciding how to structure a product form -> use this skill
- if the task is mainly about complex form-state orchestration, async field reactivity, or large dynamic field arrays, solve that in the chosen form-state layer instead of forcing the visual field layer to own it

## Default path

1. Pick one form-state strategy per app or feature and stay consistent.
2. Use shadcn field primitives for structure, labels, descriptions, and errors.
3. Keep validation logic in the schema or form-state layer, not buried inside visual components.
4. Keep submission side effects at the mutation or action boundary, not inside field wrappers.
5. Keep the field layer focused on structure and presentation when the problem becomes mostly about form-state orchestration.

## When to deviate

- Use `react-hook-form` when the app already standardizes on it and the flow is straightforward.
- Use a richer form-state layer only when the app actually needs stronger reactive state, richer async handling, or large dynamic form behavior.
- Build field-specific wrappers only when the same structure and validation presentation repeat across the product.

## Guardrails

- one form-state strategy per surface is better than mixing libraries casually
- field components should present state, not own business logic
- server validation still matters even when client validation is rich
- form wrappers should reduce duplication, not obscure the underlying state model

## Avoid

- mixing several form-state approaches inside one feature without a clear reason
- hiding business logic in `Input`, `Select`, or field wrapper components
- copying long docs examples without reducing them to the app's actual form contract
- turning the visual field layer into the source of truth for validation

## Verification checklist

- the form uses one clear state-management strategy
- visual field primitives and validation logic stay in separate layers
- repeated field wrappers exist only when they remove real duplication
- complex form-state behavior stays in the chosen form-state layer instead of being improvised in the visual field layer
- server-side validation or mutation handling is still part of the final design

## Current snapshot

- Checked against official docs on 2026-04-03
- Current npm lines verified live on 2026-04-03: `shadcn@4.1.2`, `react-hook-form@7.72.1`
- Docs in scope: shadcn forms guidance with `react-hook-form` and general field ownership patterns

## Official references

- https://ui.shadcn.com/docs/forms/react-hook-form

## References

- [Form ownership and state defaults](./references/form-ownership-and-state-defaults.md)
