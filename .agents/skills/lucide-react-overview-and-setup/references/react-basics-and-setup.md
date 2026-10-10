# Lucide React Basics And Setup

Use this file when the task has chosen Lucide React and now needs the base install and import model.

## Install

```bash
npm install lucide-react
```

## Baseline usage model

The official React package treats each icon as a typed React component:

1. install `lucide-react`
2. import only the icons you need
3. render them like any other React component
4. pass SVG-oriented props directly on the component

## Canonical props

- `size`: default `24`
- `color`: default `currentColor`
- `strokeWidth`: default `2`
- `absoluteStrokeWidth`: default `false`

Lucide React components also accept standard SVG attributes, so `className`, `aria-*`, `role`, and presentation attributes can be passed directly.

## Tree-shaking rule

Lucide's React docs explicitly position direct icon imports as tree-shakeable. Favor:

```tsx
import { Search, Settings2 } from "lucide-react";
```

Avoid building your base app layer around dynamic icon lookup unless the icon name truly comes from data.

## Import naming options

Lucide exposes multiple import names for some icons to avoid collisions:

- default style: `House`
- suffixed style: `HouseIcon`
- prefixed style: `LucideHouse`

Choose one style and keep it consistent if a codebase wants stricter imports or clearer autocomplete behavior.

## Good defaults

- inherit color with `currentColor`
- size from surrounding UI scale instead of hard-coding many one-off values
- use `absoluteStrokeWidth` when resized icons look visually too heavy or too thin

## Common mistakes

- importing every icon when only a handful are needed
- reaching for `DynamicIcon` when the icon list is static
- treating Lucide icons as data blobs instead of React components
- using multiple import naming styles with no team convention

## Official references

- React package guide: `https://lucide.dev/guide/packages/lucide-react`
- React aliased names: `https://lucide.dev/guide/react/advanced/aliased-names`

