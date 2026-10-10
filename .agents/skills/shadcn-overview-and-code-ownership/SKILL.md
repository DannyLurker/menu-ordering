---
name: shadcn-overview-and-code-ownership
description: Choose whether `shadcn/ui` is the right fit and adopt it with the right ownership model. Use when tasks mention shadcn setup, copying components into the app, owning UI source code, deciding between shadcn and a packaged component library, or routing work to theming, registry, composition, or forms follow-up skills.
---

# shadcn Overview And Code Ownership

Use this skill when the task is mainly about whether and how to adopt shadcn in a codebase.

## Scope

- deciding when shadcn is a good fit
- the code-ownership model behind shadcn
- default adoption strategy for app teams
- routing to registry, theming, composition, and forms follow-up skills

## Routing cues

- choose shadcn, adopt shadcn in an app, understand how shadcn differs from packaged component libraries, or decide the overall approach -> use this skill
- `components.json`, CLI init, `shadcn add`, registries, or update workflows -> use `shadcn-cli-registry-and-components-json`
- theme tokens, CSS variables, OKLCH colors, dark mode, or design-system defaults -> use `shadcn-theming-tokens-and-dark-mode`
- `asChild`, trigger composition, dialog and dropdown interactions, local component ownership, or wrapper boundaries -> use `shadcn-composition-and-trigger-patterns`
- form fields, `react-hook-form`, validation, or form UI ownership -> use `shadcn-forms-and-field-primitives`

## Default path

1. Use shadcn when the team wants ownable UI source code instead of a sealed package abstraction.
2. Start with the official CLI and add only the components the app actually needs.
3. Treat generated component files as application code you are expected to edit.
4. Keep local customization close to the component instead of wrapping everything immediately.
5. Build a thin app-specific UI layer only after repeated patterns are clear.

## When to deviate

- Pick a packaged library instead when the team does not want to own component code.
- Skip shadcn if the project already has a stable in-house design system with different primitives and conventions.
- Introduce shared wrappers only after the repetition is real and the ownership boundary is obvious.

## Guardrails

- Treat shadcn components as copied source, not as a magical dependency you should never touch.
- Keep the app's design tokens and visual defaults coherent before mass-adding components.
- Prefer a small local surface over a broad imported catalog.
- Route to sibling skills once the job becomes mostly about theming, registries, composition, or forms.

## Avoid

- adding many components up front “just in case”
- recreating a package-style abstraction layer on day one
- treating shadcn as if future updates should overwrite local intent automatically
- mixing several UI ownership models in one app without a clear boundary

## Verification checklist

- shadcn is being used for the right reason: ownable source code and fast customization
- only the needed components are part of the plan
- local edits are expected and accepted as part of the ownership model
- the task is routed to a sibling shadcn skill once the real problem is identified

## Current snapshot

- Checked against official docs on 2026-04-03
- Current npm line verified live on 2026-04-03: `shadcn@4.1.2`
- Docs in scope: introduction, installation, registry, and forms surfaces

## Official references

- https://ui.shadcn.com/docs
- https://ui.shadcn.com/docs/installation
- https://ui.shadcn.com/docs/registry

## References

- [Adoption defaults and ownership model](./references/adoption-defaults-and-ownership-model.md)
