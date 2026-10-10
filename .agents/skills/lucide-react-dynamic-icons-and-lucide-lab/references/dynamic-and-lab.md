# Dynamic Icons And Lucide Lab

Use this file when the task needs non-static icon loading in React.

## Prefer static imports when possible

Lucide's React docs explicitly recommend direct imports for static use cases.

That means this is better for normal app code:

```tsx
import { Bell, Settings2 } from "lucide-react";
```

Instead of routing everything through a generic icon-by-name layer.

## When `DynamicIcon` is appropriate

Use `DynamicIcon` when the icon name comes from runtime data, such as:

- CMS records
- database-backed settings
- remote configuration
- user-defined mappings that cannot be compiled statically

Import surface:

```tsx
import { DynamicIcon } from "lucide-react/dynamic";
```

## `DynamicIcon` caveats

Lucide's React docs call out these caveats:

- all icons are imported during build time
- build time increases
- bundlers create a separate module per icon
- network requests can increase
- icons may flash while loading
- SSR requires care so the icon is ready on initial render

Because of that, do not use `DynamicIcon` as the default wrapper for a static design system.

## When to use Lucide Lab

Use Lucide Lab when the icon you want is not part of the main Lucide library.

Import surface:

```tsx
import { Icon } from "lucide-react";
import { coconut } from "@lucide/lab";
```

Then pass the Lab node through `Icon`:

```tsx
<Icon iconNode={coconut} />
```

The same path also works for custom icon nodes that follow Lucide's icon node structure.

## Decision rule

- static icon set -> direct imports from `lucide-react`
- runtime icon names -> `DynamicIcon`
- icons outside the core package or custom nodes -> `Icon` + `@lucide/lab` or custom `iconNode`

## Official references

- React package guide: `https://lucide.dev/guide/packages/lucide-react`
- React dynamic icon component: `https://lucide.dev/guide/react/advanced/dynamic-icon-component`
- React with Lucide Lab: `https://lucide.dev/guide/react/advanced/with-lucide-lab`
