---
name: react-render-performance-and-state-boundaries
description: Use when React performance problems come from rerender scope, bad state ownership, or cargo-cult memoization. Covers state placement, context blast radius, render cost boundaries, and choosing fixes that reduce work instead of hiding it.
---

# React Render Performance And State Boundaries

Use this skill when the main problem is React doing too much work after state changes.

## Scope

- rerender storms
- bad state placement
- context update blast radius
- expensive derived values in hot paths
- choosing between boundary changes and memoization

## Default path

1. Find the state change that triggers the slow path.
2. Move state ownership as close as possible to the components that truly need it.
3. Reduce rerender blast radius before adding memoization.
4. Split hot and cold subtrees when one interaction keeps invalidating both.
5. Add `memo`, `useMemo`, or `useCallback` only when measurement shows they remove meaningful work.

## When to deviate

- Keep shared state higher only when multiple distant consumers truly need synchronized ownership.
- Use memoization earlier when a stable expensive child is already isolated and the props are naturally memo-friendly.
- Reach for virtualization when list size, not state placement, is the dominant cost.

## Guardrails

- State placement is usually a bigger win than sprinkling memoization.
- Context is for shared semantics, not every frequently changing local concern.
- Derived values should usually stay derived, not become mirrored state.
- Avoid making code harder to reason about for theoretical render wins.

## Avoid

- adding `useMemo` and `useCallback` everywhere by default
- storing derived values in state just to avoid recalculation
- putting frequently changing state high in the tree without a hard reason
- using one global context for data that changes at very different rates

## Verification checklist

- the triggering state change is identified
- the new state owner is deliberate
- rerender scope is smaller after the change
- memoization is justified by measured work, not habit
- the code is still easier to reason about than before

## Output Shape

When answering with this skill, prefer:

- trigger causing extra work
- current state owner
- better boundary
- whether memoization is warranted
- verification approach

## References

- [Render cost and state boundaries](./references/render-cost-and-state-boundaries.md)
