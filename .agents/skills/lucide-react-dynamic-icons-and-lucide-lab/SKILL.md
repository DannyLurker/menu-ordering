---
name: lucide-react-dynamic-icons-and-lucide-lab
description: Use `DynamicIcon`, Lucide Lab, or custom `iconNode` data in React with the right tradeoffs. Use when tasks mention `lucide-react/dynamic`, `DynamicIcon`, icon names coming from a CMS or database, `@lucide/lab`, the `Icon` component, custom Lucide nodes, or loading icons outside the core Lucide set.
---

# Lucide React Dynamic Icons And Lucide Lab

Use this skill when the app cannot rely only on static named imports from `lucide-react`.

## Scope

- `DynamicIcon` and dynamic icon names
- caveats of data-driven icon loading
- `@lucide/lab`
- the `Icon` component
- custom `iconNode` data
- choosing between direct imports, dynamic loading, and Lab/custom icons

## Default path

1. Read [references/dynamic-and-lab.md](./references/dynamic-and-lab.md).
2. Ask whether the icon list is static or data-driven.
3. If the icon set is static, route back to `lucide-react-overview-and-setup` and use direct imports.
4. Use `DynamicIcon` only when icon names truly come from runtime data such as CMS entries or database rows.
5. Use `Icon` with `@lucide/lab` or custom icon nodes when the app needs icons outside the core Lucide package.

## When to deviate

- Keep the core package only when all icons are in the main Lucide set.
- Use `Icon` plus `@lucide/lab` for non-core or custom nodes rather than forcing everything through `DynamicIcon`.
- Validate or normalize icon names before render when they come from remote data.
- Move back to the overview skill when the icon set turns out to be static after all.

## Guardrails

- `DynamicIcon` is not the default path; it increases build and delivery cost.
- Expect SSR and loading-state considerations when icon names are resolved dynamically.
- Keep runtime icon names validated or normalized instead of trusting arbitrary strings.
- Use `Icon` for Lucide Lab or custom icon nodes, not `DynamicIcon`.
- Treat `@lucide/lab` as an extension set, not the baseline icon dependency for every project.

## Avoid

- using `DynamicIcon` for a static set of known icons
- trusting arbitrary runtime icon names without validation
- treating `@lucide/lab` as a required dependency for normal app usage
- using `DynamicIcon` when the real need is a Lab or custom icon node

## Verification checklist

- the icon set is confirmed to be static or runtime-driven
- `DynamicIcon` is only used for real runtime-name scenarios
- Lab or custom nodes use `Icon`, not `DynamicIcon`
- remote icon names are validated or normalized
- SSR and loading behavior are considered when icons load dynamically

## Quick examples

Lucide Lab:

```tsx
import { Icon } from "lucide-react";
import { coconut } from "@lucide/lab";

export function LabExample() {
  return <Icon iconNode={coconut} />;
}
```

Dynamic icon by name:

```tsx
import { DynamicIcon } from "lucide-react/dynamic";

export function CmsIcon({ name }: { name: string }) {
  return <DynamicIcon name={name} size={18} />;
}
```

## Current snapshot

- Checked against official docs on 2026-04-03
- Current npm line verified live on 2026-04-03: `@lucide/lab@0.1.2`
- Official React docs still recommend direct imports for static use cases and reserve `DynamicIcon` for runtime-name scenarios

## References

- [Dynamic icons and Lucide Lab](./references/dynamic-and-lab.md)
