---
name: improve-codebase-architecture
description: Use when exploring a codebase for architectural improvement opportunities. Covers finding shallow modules, identifying bad seams, proposing deeper boundaries, and turning structural friction into concrete refactor candidates.
---

# Improve Codebase Architecture

Use this skill when the user wants architectural improvement ideas before touching implementation.

## Scope

- finding shallow or tightly coupled modules
- identifying poor seams between features
- spotting places where boundaries are hard to test
- proposing deeper modules and simpler public interfaces
- generating concrete architectural refactor candidates

## Default path

1. Explore the codebase like a new contributor would.
2. Note where understanding one concept requires too much file-hopping.
3. Find boundaries where interfaces are almost as complex as the internals.
4. Group friction into architectural candidates instead of isolated complaints.
5. For each candidate, describe:
   - current friction
   - likely deeper boundary
   - testing impact
   - tradeoffs
6. Recommend the best candidate to pursue first.

## When to deviate

- Zoom into one subsystem only when one boundary clearly dominates the architectural pain.
- Recommend no architectural change if the main issue is local implementation quality rather than a bad seam.
- Escalate to a refactor plan once one candidate is clearly worth pursuing.

## Guardrails

- Do not propose broad rewrites without a specific boundary problem.
- Favor deeper modules over just moving files around.
- Focus on seams that improve testability and change safety.
- Keep recommendations tied to user-facing or developer-facing pain, not aesthetics.

## Avoid

- proposing a rewrite without a concrete boundary failure
- confusing file shuffling with architecture improvement
- optimizing for conceptual neatness while ignoring testability or change safety
- generating a long complaint list without grouping it into candidates

## Verification checklist

- each candidate is tied to a real friction point
- the stronger boundary is described in terms of what it would hide
- testability or change-safety impact is explicit
- tradeoffs are named, not implied
- one candidate is recommended as the best first move

## Output Shape

When answering with this skill, prefer:

- candidate list
- why each boundary is weak today
- what a stronger boundary would hide
- which candidate should go first

## Good Triggers

- improve architecture, refactor boundaries, shallow modules, tightly coupled code, make this codebase easier to navigate
