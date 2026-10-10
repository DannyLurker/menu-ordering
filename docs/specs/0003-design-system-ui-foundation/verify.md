# Verify: design system and UI foundation · spec 0003 · updated 2026-10-10

_Steps derived from spec 0003 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

- [x] Visit `/ui-preview` at 375px wide → tokens plus all five parts plus primitives render with no horizontal scroll, Indonesian sample included → AC-1, AC-2
- [x] Keyboard walk the preview (Tab to reach, Enter or Space to act, Escape closes dialog, focus returns to trigger) → every part operable with a visible focus ring → AC-3
- [x] Contrast audit → white text on brand 4.69, red text 6.57, ink 17.49, muted 7.63; brand red never on normal body text → AC-4
- [x] Reduced motion on → fades collapse, every part still shows loading plus empty plus error → AC-5
- [x] Kitchen glance section → status text at least 32px semibold → AC-6
- [x] Grep `components/ui/` for hardcoded copy → labels arrive via props or children only (dialog close label is a prop) → AC-7

## Commands

- [x] `pnpm build` passes with `/ui-preview` prerendered → AC-1 to AC-7
- [x] `pnpm tsc --noEmit` passes with no errors → AC-1 to AC-7

## Acceptance-criteria coverage

- AC-1 covered by token file plus preview render · AC-2 by parts on 375px plus ID sample · AC-3 by keyboard walk · AC-4 by measured ratios · AC-5 by reduced motion plus state looks · AC-6 by glance scale · AC-7 by prop only labels check
