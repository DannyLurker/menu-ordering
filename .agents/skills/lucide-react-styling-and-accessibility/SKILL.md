---
name: lucide-react-styling-and-accessibility
description: Style `lucide-react` icons consistently and keep them accessible. Use when tasks mention `LucideProvider`, global icon CSS, the `.lucide` class, `title`, `aria-label`, icon-only buttons, contrast, non-scaling strokes, or icon semantics in React UI.
---

# Lucide React Styling And Accessibility

Use this skill when the task is about making Lucide icons consistent across the app and keeping them accessible in actual UI.

## Scope

- global styling with CSS
- app-wide defaults with `LucideProvider`
- sizing, color, stroke width, and non-scaling strokes
- `title` and `aria-label` for standalone meaningful icons
- icon-only buttons and screen-reader behavior
- choosing whether an icon should stay decorative

## Default path

1. Read [references/styling-and-a11y.md](./references/styling-and-a11y.md).
2. Decide whether the task needs local props, global CSS, or `LucideProvider`.
3. Keep decorative icons hidden from assistive tech unless they convey essential meaning on their own.
4. Put accessible names on the interactive wrapper, not on the icon, when the icon sits inside a button or link.
5. If the task starts loading icons by name or from Lucide Lab, route to `lucide-react-dynamic-icons-and-lucide-lab`.

## When to deviate

- Use per-icon props when only a small number of icons need overrides.
- Use `LucideProvider` when the app wants shared defaults with occasional local overrides.
- Expose the icon itself to assistive tech only when it carries meaningful standalone content.
- Move to the dynamic skill if the styling problem is actually caused by runtime icon loading or Lab usage.

## Guardrails

- Prefer CSS for broad icon styling when per-icon overrides are not needed.
- Use `LucideProvider` when the app wants shared defaults but still needs per-icon prop overrides.
- Do not label decorative icons just to satisfy a checklist.
- Do not place the accessible name on the icon when a button already owns that interaction.
- Keep sufficient contrast and usable hit targets for interactive icon affordances.

## Avoid

- adding `aria-label` to decorative icons
- putting accessible names on both the icon and its interactive wrapper
- using provider-level defaults when a local one-off prop would be clearer
- forgetting contrast and hit-target size on icon-only controls

## Verification checklist

- the styling choice is local props, CSS, or `LucideProvider` for a reason
- decorative icons stay hidden from assistive tech
- icon-only buttons carry the accessible name on the button, not the icon
- global defaults still allow local overrides where needed
- contrast and target size are adequate for interactive usage

## Quick example

```tsx
import { LucideProvider, Search } from "lucide-react";

export function ToolbarButton() {
  return (
    <LucideProvider value={{ size: 18, strokeWidth: 1.75 }}>
      <button type="button" aria-label="Search">
        <Search />
      </button>
    </LucideProvider>
  );
}
```

## Current snapshot

- Checked against official docs on 2026-04-03
- React styling guide in scope: CSS `.lucide` class and `LucideProvider`
- React accessibility guide in scope: icons default to `aria-hidden="true"` unless explicitly labeled

## References

- [Styling and accessibility](./references/styling-and-a11y.md)
