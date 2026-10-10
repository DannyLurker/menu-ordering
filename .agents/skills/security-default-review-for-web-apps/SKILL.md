---
name: security-default-review-for-web-apps
description: Use when reviewing a web app for practical security risk before coding or shipping. Covers trust boundaries, attacker-controlled input, privileged actions, secret exposure, and routing the problem to narrower security skills without pretending to do a full security audit.
---

# Security Default Review For Web Apps

Use this skill when the task is to find the highest-risk web security boundary before the team starts patching randomly.

## Scope

- high-level security review for web apps
- deciding whether the main risk is secrets, authorization, or input handling
- identifying public input and privileged actions
- routing to narrower security skills

## Routing cues

- security review, secure by default, trust boundary, secret exposure, authz review, dangerous sink, or “what is the main risk here” -> use this skill
- if the core issue is client vs server boundary or secret handling -> use `security-client-server-boundary-and-secret-exposure`
- if the core issue is permissions, actor trust, or multi-tenant access -> use `security-authz-and-trust-boundaries`
- if the core issue is untrusted input reaching dangerous sinks -> use `security-input-validation-and-dangerous-sinks`

## Default path

1. List the public inputs, authenticated actors, and privileged actions.
2. Identify where secrets or sensitive data live.
3. Mark the trust boundaries:
   - browser vs server
   - unauthenticated vs authenticated
   - authenticated vs authorized
   - internal service vs external caller
4. Pick the highest-risk boundary.
5. Route the fix through the narrower security skill that owns that boundary.

## When to deviate

- Stay at the overview level only when the user truly needs a triage map rather than a fix.
- Escalate beyond these skills when the issue is infrastructure, cryptography, or compliance-specific rather than app-boundary specific.

## Guardrails

- Do not call this a full security audit.
- Prioritize exploitable trust-boundary mistakes over broad best-practice checklists.
- Treat the browser as untrusted by default.
- Separate authentication, authorization, and input safety clearly.

## Avoid

- giving equal weight to every theoretical issue
- focusing only on XSS and SQL injection while missing authz failures or secret leaks
- trusting UI checks as a security boundary
- calling a review complete without naming the highest-risk surface

## Verification checklist

- public inputs and privileged actions are listed
- trust boundaries are explicit
- one highest-risk boundary is named
- the problem is routed to the right narrower security skill
- no false claim of full audit coverage is made

## Output Shape

When answering with this skill, prefer:

- trust boundary map
- highest-risk boundary
- why it matters
- next specialized skill

## References

- [Default review map](./references/default-review-map.md)
