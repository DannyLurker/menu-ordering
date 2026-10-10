---
name: request-refactor-plan
description: Use when planning a refactor before implementation starts. Covers scope clarification, alternatives, testing strategy, tiny-commit sequencing, and writing a refactor plan that stays durable even if the code layout changes.
---

# Request Refactor Plan

Use this skill when the user wants a refactor plan, not a direct code change.

## Scope

- clarifying the real problem behind a refactor request
- evaluating alternative approaches
- defining what is in and out of scope
- checking test coverage expectations
- breaking the work into small safe commits

## Default path

1. Capture the refactor goal in the user's terms.
2. Inspect the relevant code to verify the current state.
3. Identify at least one alternative to the proposed direction.
4. Clarify scope, boundaries, and non-goals.
5. Check what tests already protect the area and what new tests are needed.
6. Write the plan as tiny commits that leave the system working at each step.

## When to deviate

- Treat the work as a feature plan instead if the request actually changes behavior rather than structure.
- Collapse alternatives only when one direction is already strongly constrained by the codebase or product requirements.
- Escalate to architecture review if the refactor request is really about a larger boundary problem than one plan can safely cover.

## Guardrails

- Do not confuse a refactor with a feature request.
- Keep the plan durable: avoid coupling it to exact file paths unless necessary.
- Make each step small enough to review and revert safely.
- If test coverage is missing, say so explicitly in the plan.

## Avoid

- treating a behavior change like a pure refactor
- writing one giant “do everything” refactor step
- tying the plan too tightly to file paths when the boundary can be described conceptually
- hand-waving missing tests

## Verification checklist

- the problem statement distinguishes refactor from feature work
- at least one alternative was considered
- scope and non-goals are explicit
- each step is small enough to review and revert
- testing coverage and gaps are called out clearly

## Output Shape

When answering with this skill, prefer:

- problem statement
- recommended direction
- alternatives considered
- commit-by-commit plan
- testing decisions
- out-of-scope section

## Good Triggers

- plan this refactor, refactor RFC, break refactor into steps, incremental refactor plan
