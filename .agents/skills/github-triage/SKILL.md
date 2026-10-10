---
name: github-triage
description: Use when triaging GitHub issues or incoming bug reports. Covers fast issue review, category and state decisions, codebase context gathering, next-action recommendations, and preparing issues for implementation without jumping straight into code.
---

# GitHub Triage

Use this skill when the task is to sort, qualify, or prepare GitHub work.

## Scope

- reviewing new issues
- categorizing bugs vs enhancements
- identifying missing information
- deciding whether an issue is ready for implementation
- summarizing next action for maintainers or agents

## Default path

1. Read the issue body, labels, and recent comments.
2. Restate the problem in one line.
3. Decide whether it is:
   - bug
   - enhancement
   - question
   - duplicate or out of scope
4. Check the codebase only enough to understand the relevant domain and likely boundary.
5. Recommend one next state:
   - needs info
   - ready to implement
   - needs design
   - not actionable
6. If actionable, note the likely testable behavior and affected boundary.

## When to deviate

- Investigate deeper only if the issue already looks actionable and the missing confidence is technical rather than descriptive.
- Escalate to design instead of implementation when the issue is really a product or UX decision.
- Close as duplicate or out of scope only when that state is defensible from the issue history or codebase context.

## Guardrails

- Do not start implementing during triage.
- Do not over-investigate before deciding whether the issue is even valid.
- Keep the issue durable: describe behavior, not file paths.
- Separate “not enough information” from “not a real bug.”

## Avoid

- jumping into code changes during triage
- over-reading the codebase before deciding whether the issue is valid
- confusing missing information with invalid reports
- writing triage notes that only make sense if the file layout never changes

## Verification checklist

- the issue is restated in one clear sentence
- the category is explicit
- missing information, if any, is concrete
- the next state is chosen intentionally
- if actionable, the likely boundary and testable behavior are identified

## Output Shape

When answering with this skill, prefer:

- issue summary
- category
- confidence level
- missing information, if any
- recommended next action

## Good Triggers

- triage this issue, review incoming issues, classify this bug, is this ready to implement, GitHub triage
