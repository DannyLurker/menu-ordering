---
name: lucide-react-overview-and-setup
description: Set up `lucide-react`, choose the right import pattern, and route icon work to the right Lucide follow-up skill. Use when tasks mention `lucide-react`, Lucide installation, icon imports, SVG props, `absoluteStrokeWidth`, import aliases like `HouseIcon` or `LucideHouse`, or deciding whether to use direct imports, `DynamicIcon`, or `@lucide/lab`.
---

# Lucide React Overview And Setup

Use this skill for first-time Lucide setup and for choosing the right Lucide React path before going deeper.

## Scope

- installing `lucide-react`
- importing Lucide icons as React components
- core props like `size`, `color`, `strokeWidth`, and `absoluteStrokeWidth`
- import naming patterns such as `House`, `HouseIcon`, and `LucideHouse`
- deciding when work belongs to styling and accessibility vs dynamic icons and Lucide Lab

## Routing cues

- install Lucide, replace an icon library with Lucide, import icons in React, icon component props, Lucide aliases, `absoluteStrokeWidth`, tree-shaking -> use this skill
- global icon defaults, CSS styling, `LucideProvider`, icon-only button accessibility, `title`, `aria-label`, or screen-reader behavior -> use `lucide-react-styling-and-accessibility`
- `DynamicIcon`, icon names from CMS or database, `lucide-react/dynamic`, `@lucide/lab`, custom `iconNode`, or non-core icons -> use `lucide-react-dynamic-icons-and-lucide-lab`

## Default path

1. Read [references/react-basics-and-setup.md](./references/react-basics-and-setup.md) first.
2. Install only `lucide-react` for standard React usage.
3. Prefer direct named imports from `lucide-react` so bundlers only include used icons.
4. Use icon props for local adjustments and route out if the task is really about app-wide defaults, accessibility, or dynamic loading.
5. If the task wants icons by name or icons outside the core set, move to the dynamic and Lab skill instead of stretching base imports too far.

## When to deviate

- Use import alias styles only when the codebase needs stricter naming consistency or collision avoidance.
- Reach for `@lucide/lab` only when the icon is outside the core set or a custom icon node is required.
- Move to dynamic loading only when icon names truly come from runtime data.

## Guardrails

- Prefer direct named imports over generic dynamic loading for normal app code.
- Treat Lucide icons as React components, not raw data objects.
- Keep icon choice explicit in code when the icon set is static.
- Use the default import surface unless the task specifically needs prefixed or suffixed aliases.
- `absoluteStrokeWidth` is for preserving stroke appearance while resizing, not a substitute for all styling decisions.

## Avoid

- wrapping all icon usage in a generic dynamic layer by default
- importing more icons than the app actually uses
- treating Lucide icons like data objects instead of React components
- introducing alias styles inconsistently across the same codebase

## Verification checklist

- `lucide-react` is the only required package for the core use case
- icons are imported directly when the icon set is static
- alias naming style, if used, is deliberate and consistent
- dynamic loading or Lab usage is only introduced for a real need
- the response routes to styling or dynamic skills when those concerns dominate

## Quick example

```tsx
import { Camera, HouseIcon } from "lucide-react";

export function Example() {
  return (
    <div className="flex items-center gap-2">
      <Camera size={18} />
      <HouseIcon absoluteStrokeWidth />
    </div>
  );
}
```

## Canonical packages

- `lucide-react`
- `@lucide/lab` only when the task needs Lucide Lab or custom icon nodes

## Current snapshot

- Checked against official docs on 2026-04-03
- Current npm line verified live on 2026-04-03: `lucide-react@1.7.0`
- Current Lucide repo activity verified live on 2026-04-03: active public repo with same-day push and recent merged PRs

## References

- [React basics and setup](./references/react-basics-and-setup.md)
