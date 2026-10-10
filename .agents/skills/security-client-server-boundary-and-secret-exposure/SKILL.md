---
name: security-client-server-boundary-and-secret-exposure
description: Use when a web app risks exposing secrets or privileged behavior across the client-server boundary. Covers server-only logic, public env variables, scoped tokens, browser trust assumptions, and moving sensitive work out of the client.
---

# Security Client Server Boundary And Secret Exposure

Use this skill when the risky move would be letting the browser see or influence something that should stay server-only.

## Scope

- secret exposure
- public vs server-only environment variables
- leaking privileged tokens to the browser
- pushing business rules or authorization into client code
- internal API and server action boundary mistakes

## Default path

1. Assume the browser is untrusted.
2. Keep secrets, privileged credentials, and vendor private keys on the server only.
3. Expose only the minimum public identifiers or scoped tokens truly needed by the client.
4. Run privileged reads, writes, and policy checks on the server.
5. Treat hidden fields, local storage, and client props as attacker-controlled input.

## When to deviate

- Use short-lived scoped client tokens only when the vendor flow truly requires direct browser access.
- Keep harmless publishable keys public only when the downstream provider explicitly designs them that way.
- Allow client-side hints for UX, but re-check the privileged decision on the server.

## Guardrails

- `NEXT_PUBLIC_*` and equivalent client-exposed config are public by definition.
- UI gating is not authorization.
- Never rely on “users cannot see this value in the UI” as protection.
- Keep third-party admin credentials, signing keys, and private API keys off the client entirely.

## Avoid

- putting secrets in client bundles or public env vars
- trusting client-calculated price, role, or ownership values
- exposing internal admin APIs because the route is “hard to find”
- treating obfuscation as a security boundary

## Verification checklist

- all secrets are server-only
- any client token is intentionally scoped and limited
- privileged decisions execute on the server
- the browser is treated as attacker-controlled
- no UI-only guard is mistaken for authorization

## Output Shape

When answering with this skill, prefer:

- what must stay server-only
- what may be exposed safely
- which decisions must move server-side
- the main secret-exposure risk

## References

- [Secret and boundary defaults](./references/secret-and-boundary-defaults.md)
