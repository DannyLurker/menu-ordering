# Review, master, 2026-10-10

**Reviewed by**: big-pickle (author on Muse Spark)
**Scope**: 12 files, uncommitted (working tree on `master`)
**Verdict**: Changes requested

## Summary

This change lays down spec 0003's design system: a single Tailwind v4 `@theme` token file (brand red on white), a system type stack replacing Geist, an `IconProvider`, and six owned UI parts (Button, Input, Card, Badge, Dialog, Spinner/Context primitives) rendered on an unlinked `/ui-preview` surface. The token discipline is strong: no hardcoded colors leak into components, keyboard/ARIA behavior rides on Radix, and reduced-motion plus forced-colors handling are present. The headline issue is an internally inconsistent ARIA wiring in `Input` (a dangling `aria-describedby` plus a silently dropped hint on the exactly-common hint+error case). Several small spec drifts (danger hover is a no-op, Card's `raised` state and `title`/`action` contract are absent, no dialog closing fade) round it out, and there is no test coverage for the branching UI logic the spec relies on manual verify to catch.

## Major

### 🟠 `Input` computes `aria-describedby` from a hint it then hides, leaving a dangling IDREF, `components/ui/input.tsx:13-15,37-41`
**Problem**: `describedBy` is built from `hintId` and `errorId` whenever those props exist, but the hint paragraph only renders under `hint && !error`. So when a caller passes both `hint` and `error` (the normal invalid form state the spec example exercises), the input is given `aria-describedby="<id>-hint <id>-error"` while only the `<p id="<id>-error">` is in the DOM. The `<id>-hint` reference points at nothing, and the hint text is removed from both the visual UI and the accessible description at the moment the user most needs it. The spec's Input contract explicitly promises "hint plus error exposed via describedby."
**Why it matters**: Invalid ARIA references are a real accessibility defect, and this is the project's stated central deliverable (accessibility before screens exist). Screen-reader users lose the hint precisely on validation failure, and the DOM contract no longer matches what the spec promises.
**Suggested fix**: Pick one behavior and make the render and the ARIA agree. Either keep the hint rendered alongside the error, or (if error should replace hint) only add `hintId` to `describedBy` when the hint paragraph actually renders. Add a test for the hint+error combination (see Test coverage).

## Minor

### 🟡 Danger button hover is a no-op because `destructive` and `brand-deep` are the same color, `components/ui/button.tsx:13`
**Problem**: `danger` uses `bg-destructive ... hover:bg-brand-deep`, but `--color-destructive` and `--color-brand-deep` are both `#a81612` (`app/globals.css:27,35`). Hovering a danger button produces no visual change.
**Why it matters**: Users get no hover/press feedback on destructive actions; it also signals the tokens were not cross-checked against each other.
**Suggested fix**: Give danger a distinct darker hover value (e.g. a dedicated deep-danger token), or point hover at a genuinely different shade.

### Dialog claims a closing fade but only animates open; `--animate-fade-out` is dead, `components/ui/dialog.tsx:24,28`, `app/globals.css:48,59-66`
**Problem**: The Content/Overlay only carry `animate-fade-in`. The spec's Dialog row lists "open, closing fade", and `--animate-fade-out` plus its `@keyframes fade-out` are defined but never referenced anywhere.
**Why it matters**: The stated closing transition does not exist (Radix unmounts without exit animation), and the unused token is dead code that misleads later authors into thinking it is wired.
**Suggested fix**: Either implement the exit animation (e.g. Radix `forceMount` + a presence/animate wrapper) or drop the claim and the unused `--animate-fade-out`/`fade-out` definitions so the token file matches reality.

### `DialogContent` hardcodes user-facing copy as a default, `components/ui/dialog.tsx:19,36`
**Problem**: `closeLabel = "Close"` is English user-facing text baked into a base part. AC-7 requires base parts to carry no hardcoded user-facing copy and to take labels via props/children.
**Why it matters**: Any Indonesian screen that forgets to pass `closeLabel` leaks an English accessible name. The verify note ("dialog close label is a prop") glosses over the fact that the default is still copy.
**Suggested fix**: Require `closeLabel` (no default) or source it from a prop supplied by the screen, keeping the part copy-free per AC-7.

### Card deviates from the spec's `title`/`action` contract and omits the `raised` state, `components/ui/card.tsx:4,28`
**Problem**: The spec's Card row lists `title` (optional), `action` (optional) and states `plain, raised for menu groups, empty look defined`. The implementation instead exposes composition sub-parts (`CardHeader`/`CardTitle`/`CardContent`/`CardFooter`) and only `CardEmpty`; there is no `raised` variant and no `title`/`action` props.
**Why it matters**: A spec/decision contradiction (review category 7). The composition approach is defensible and arguably cleaner, but the spec table and the `/develop` "update the plan to match what was built" expectation were not reconciled, so the source of truth now lies.
**Suggested fix**: Add the `raised` variant (it is used for menu groups in later slices), and update the spec's Card row to describe the composition API and states actually shipped.

### Quiet Button border deviates from the spec table without a spec update, `components/ui/button.tsx:12`, `docs/specs/0003-design-system-ui-foundation/index.md:62`
**Problem**: The spec's Button contract says the `quiet` variant is "transparent, ink text"; the build adds `border border-input` and `hover:bg-muted`. Per the known context this was a direct post-build engineer request, but the spec table still says transparent.
**Why it matters**: Explicit decision drift not recorded in the governing spec; the next reader trusts the table and gets a different visual.
**Suggested fix**: Update the spec's Button row to the shipped `quiet` treatment (border + hover), and note the request that changed it. Not a code change.

### Focus ring has no white offset ring on red fills, `app/globals.css:78-81`
**Problem**: The spec's focus-ring token row calls for "2px brand red with 2px white offset, white ring on red fills". The implementation applies a single global `outline: 2px solid var(--color-ring); outline-offset: 2px`. On a white/paper background the 2px offset reveals white, so it reads correctly; but on any brand-red fill (e.g. a primary button placed on a red header in a later slice) the red ring sits over red and can disappear.
**Why it matters**: Keyboard focus visibility is an AC-3 invariant and later screens will place primary actions on brand surfaces.
**Suggested fix**: Add the white offset (e.g. a `box-shadow: 0 0 0 2px white` companion on focus, or a per-surface focus treatment) so the ring survives on red fills.

### No tests for the interactive, branching UI logic, `components/ui/` (suite: `lib/db.test.ts`, `lib/pin.test.ts`, `prisma/data-model.test.ts`)
**Problem**: Test signal is `configured` (vitest) but the new parts have no coverage. The `Input` describedby/error logic, Button variant resolution, and Dialog close-label/prop behavior are all branching logic, which the rubric puts at the Major bar for missing coverage.
**Why it matters**: The spec gates these components on a manual keyboard/contrast walk in `verify.md`, which is a one-time pass and will not catch regressions as later slices compose these parts.
**Suggested fix**: Add a small vitest + Testing Library suite covering the Input hint/error describedby contract (which would have caught the Major), the Button variant/size classes, and the Dialog close-label default. Run it through `/test`.

## Nits

- ⚪ `components/ui/spinner.tsx:5`, `app/ui-preview/page.tsx:119` — `data-icon="inline-start"` is inert: nothing in `app/globals.css` (or elsewhere) targets `[data-icon]`, so these are dead attributes. Either wire the intended styling or drop them.
- ⚪ `components/ui/icons.tsx:7` — the provider's `size={18}` is overridden by `[&_svg]:size-4` (16px) in Button and explicit `size-4` on Spinner/the dialog close icon, so the 18px default rarely takes effect. Pick one icon-size convention.
- ⚪ `app/ui-preview/page.tsx:22` — the swatch label hardcodes `Brand #E1251B` while the token comment still calls the hex approximate; the demo label will silently drift once exact sampling lands.
- ⚪ `components/ui/badge.tsx:11` — `ok` (`bg-muted text-foreground`) is nearly indistinguishable from `neutral` (`bg-muted text-muted-foreground`); consider a distinct treatment if `ok` must read as positive.
- ⚪ `components/ui/primitives.tsx:5` — `Container` uses a flat `px-4`, which is not "roomy padding" on desktop; consider responsive padding.

## Strengths

- Token discipline is genuine: every component colors through `@theme` variables, and no hardcoded hex/rgb leaks into `components/ui/` or `/ui-preview`.
- Keyboard and AT behavior is delegated correctly to Radix (`DialogTitle`/`Description` auto-wiring, focus trap, Escape, focus return), and there is a global `:focus-visible` plus a forced-colors fallback.
- Reduced-motion handling is implemented once, globally, rather than scattered per component, and `Prefer` light-only theme removed the scaffold's `prefers-color-scheme` block as the spec's invariant required.

## Test coverage

Configured runner (vitest, 21 data-model tests) with zero coverage of the new UI. The spec deliberately proves this feature with a manual `/check verify` walk, so the missing coverage is not itself surprising, but the `Input` branching logic is exactly the kind of contract that a test would lock down and that manual verification misses at regression time. The most valuable single test is the hint+error `aria-describedby` contract, which would have caught the Major above.
