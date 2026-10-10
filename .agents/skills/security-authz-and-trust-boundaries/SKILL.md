---
name: security-authz-and-trust-boundaries
description: Use when the real security question is whether the current actor is allowed to do the thing, not whether they are merely authenticated. Covers server-side authorization, ownership checks, tenant boundaries, role use, and avoiding trust in user-controlled identifiers.
---

# Security Authz And Trust Boundaries

Use this skill when the main risk is unauthorized access caused by weak trust-boundary design.

## Scope

- authorization checks
- ownership verification
- role and permission design
- tenant isolation
- trusting user-controlled identifiers

## Default path

1. Derive the actor from the trusted server-side auth context.
2. Define the resource and action being authorized.
3. Check authorization on the server for every privileged read and write.
4. Verify ownership, tenant membership, or explicit permission at the resource boundary.
5. Default to deny when the actor-resource relation is unclear.

## When to deviate

- Use coarse role checks only when resources are not user-scoped or tenant-scoped.
- Cache authorization decisions only when invalidation and revocation are explicit.
- Allow UI-based filtering for UX only if the server still enforces the same boundary.

## Guardrails

- Authentication is not authorization.
- Resource identifiers from the client are not proof of access.
- Role checks alone are often insufficient in multi-tenant or ownership-based apps.
- Keep authorization close to the action, not only at route entry.

## Avoid

- checking permissions only in the UI
- trusting `userId`, `tenantId`, or `role` values from request payloads
- authorizing broad route access while skipping resource-level checks
- default-allow behavior when actor-resource relationship is missing

## Verification checklist

- actor comes from trusted auth context
- resource and action are explicit
- authorization happens on the server
- ownership or tenant checks are enforced where needed
- default deny behavior is clear

## Output Shape

When answering with this skill, prefer:

- actor
- resource
- action
- required trust boundary
- missing or weak authorization check

## References

- [Trust boundary checklist](./references/trust-boundary-checklist.md)
