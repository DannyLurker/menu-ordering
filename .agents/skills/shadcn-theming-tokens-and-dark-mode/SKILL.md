---
name: shadcn-theming-tokens-and-dark-mode
description: Use when defining shadcn theme defaults that the model should not improvise per component. Covers CSS variables, semantic tokens, OKLCH-based palettes, dark mode, and the rule that visual consistency should come from tokens and composition instead of one-off utility overrides.
---

# shadcn Theming Tokens And Dark Mode

Use this skill when the task is mainly about visual defaults, token strategy, or dark-mode behavior in a shadcn app.

## Scope

- theme tokens
- CSS variables mode
- semantic color mapping
- dark mode strategy
- keeping component-level styling overrides under control

## Routing cues

- shadcn theming, `:root`, CSS variables, OKLCH colors, semantic tokens, dark mode, theme provider, `next-themes`, or visual consistency across components -> use this skill
- if the work is mainly about CLI init or `components.json` -> use `shadcn-cli-registry-and-components-json`
- if the work is mainly about component composition and trigger behavior -> use `shadcn-composition-and-trigger-patterns`

## Default path

1. Use CSS variables mode for app-wide theming.
2. Define semantic tokens first: background, foreground, card, popover, primary, secondary, muted, accent, border, input, ring, and chart or sidebar tokens if the app needs them.
3. Keep brand decisions in token values, not repeated utility overrides inside every component.
4. Use one dark-mode strategy for the whole app and wire it early.
5. Let components consume tokens through their default class contracts before adding custom variants.

## When to deviate

- Use hardcoded per-component utility styling only when the component is intentionally one-off.
- Add extra token families only when a repeated product surface truly needs them.
- Skip dark mode only when the product has a deliberate single-theme stance.

## Guardrails

- tokens should describe semantics, not page-specific hacks
- brand color changes belong in variables, not in mass component edits
- dark mode should be an application decision, not a component-by-component experiment
- keep contrast and readability intact when shifting tokens

## Avoid

- styling every shadcn component with ad hoc utility overrides instead of fixing the token layer
- creating token names that encode one page or one feature
- adding several parallel dark-mode patterns in the same app
- using theme state to solve layout or composition problems

## Verification checklist

- the app has one coherent token layer instead of scattered one-off colors
- dark mode is configured once and applied consistently
- component styling changes mostly come from tokens or a small number of variants
- semantic token names still make sense after the customization

## Current snapshot

- Checked against official docs on 2026-04-03
- Current npm line verified live on 2026-04-03: `shadcn@4.1.2`
- Docs in scope: theming and dark mode

## Official references

- https://ui.shadcn.com/docs/theming
- https://ui.shadcn.com/docs/dark-mode

## References

- [Token and dark-mode defaults](./references/token-and-dark-mode-defaults.md)
