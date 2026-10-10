---
name: shadcn-cli-registry-and-components-json
description: Use when initializing shadcn, managing `components.json`, adding components or blocks through the CLI, or deciding how registries and updates should work without losing local ownership. Covers CLI defaults, registry boundaries, aliases, CSS entrypoints, and safe update posture.
---

# shadcn CLI Registry And components.json

Use this skill when the task is about shadcn CLI setup, registry usage, or `components.json` ownership.

## Scope

- `shadcn init`
- `components.json` structure and stability
- registry add flows
- local and remote registry boundaries
- update posture for copied component code

## Routing cues

- init shadcn, configure `components.json`, `shadcn add`, aliases, style selection, CSS entrypoint, registries, monorepo setup, or update strategy -> use this skill
- if the work is really about tokens, theme CSS, or dark mode -> use `shadcn-theming-tokens-and-dark-mode`
- if the work is really about local component composition and `asChild` patterns -> use `shadcn-composition-and-trigger-patterns`

## Default path

1. Initialize shadcn once through the CLI and commit `components.json`.
2. Keep aliases and CSS entrypoints accurate before adding more components.
3. Treat the chosen style and base configuration as stable project-level decisions.
4. Add components from the official registry one at a time as real product needs appear.
5. Prefer local code edits after generation rather than expecting repeatable upstream overwrites to preserve your intent.
6. Introduce custom registries only when you truly have reusable internal UI assets worth distributing.

## When to deviate

- Use a custom registry only when you already have reusable internal patterns that should be shared across repos.
- Re-run generated updates selectively when upstream fixes are valuable and the local diff is understood.
- Use a monorepo-aware alias layout only when the codebase structure actually needs it.

## Guardrails

- `components.json` is a repo contract, not a throwaway scaffold file.
- Keep path aliases and CSS entrypoints correct before any bulk `add` flow.
- Add components intentionally; do not mass-import the registry.
- Treat generated files as owned code after creation.
- Prefer one registry strategy per repo instead of mixing ad hoc sources.

## Avoid

- deleting or rewriting `components.json` casually after the app starts using it
- bulk-adding components because the catalog looks convenient
- assuming future `add` or update runs are a safe substitute for code review
- creating a private registry before there is a real shared surface to publish

## Verification checklist

- `components.json` matches the real repo aliases and CSS entrypoint
- the component add plan is incremental, not bulk and speculative
- registry usage is deliberate and consistent
- generated code is treated as locally owned after import
- update strategy is explicit instead of assumed

## Quick example

```bash
npx shadcn@latest init
npx shadcn@latest add button dialog form
```

## Current snapshot

- Checked against official docs on 2026-04-03
- Current npm line verified live on 2026-04-03: `shadcn@4.1.2`
- Docs in scope: installation, CLI, `components.json`, and registries

## Official references

- https://ui.shadcn.com/docs/installation
- https://ui.shadcn.com/docs/components-json
- https://ui.shadcn.com/docs/registry
- https://ui.shadcn.com/docs/cli

## References

- [CLI and registry defaults](./references/cli-and-registry-defaults.md)
