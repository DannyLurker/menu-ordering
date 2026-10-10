# Lucide React Styling And Accessibility

Use this file when the task is already inside Lucide React and needs app-level styling or accessibility decisions.

## Styling options

Lucide documents two main global styling paths:

1. CSS targeting the shared `.lucide` class
2. `LucideProvider` for app-wide default props

## When to use CSS

Use CSS when the app wants one broad icon look:

- shared color
- shared width and height
- shared stroke width

Example model:

```css
.lucide {
  color: currentColor;
  width: 20px;
  height: 20px;
  stroke-width: 1.75;
}
```

For non-scaling strokes across resized icons, Lucide documents:

```css
.lucide * {
  vector-effect: non-scaling-stroke;
}
```

## When to use `LucideProvider`

Use `LucideProvider` when you want shared defaults but still need prop-level overrides for certain icons.

Typical use:

- set `size`, `color`, or `strokeWidth` once near the app or section boundary
- override individual icons only where needed

## Accessibility defaults

Lucide React icons are hidden from screen readers by default with `aria-hidden="true"`.

That is usually correct because most icons are decorative or reinforce nearby text.

## Make an icon accessible only when needed

Expose the icon when it carries essential meaning by itself. Lucide's React docs call out two main ways:

- pass `aria-label`
- pass a `title` child

## Icon button rule

For icon-only buttons, put the accessible label on the button:

```tsx
<button type="button" aria-label="Close">
  <X />
</button>
```

Do not label the nested icon separately unless the icon itself is the actual standalone semantic element.

## UI guardrails

- keep contrast high enough against the background
- do not rely only on color for meaning
- keep interactive wrappers large enough to hit comfortably
- avoid exposing decorative icons to screen readers

## Official references

- React global styling: `https://lucide.dev/guide/react/advanced/global-styling`
- React accessibility: `https://lucide.dev/guide/react/advanced/accessibility`
- Accessibility in depth: `https://lucide.dev/guide/accessibility`

