---
name: security-input-validation-and-dangerous-sinks
description: Use when untrusted input may reach SQL, HTML, filesystem, shell, redirects, or other dangerous sinks. Covers validation, normalization, parameterization, output encoding, and refusing vague “sanitize everything” advice.
---

# Security Input Validation And Dangerous Sinks

Use this skill when the risk comes from attacker-controlled input flowing into a dangerous sink.

## Scope

- input validation
- normalization
- parameterized database access
- HTML and output-context encoding
- shell, path, redirect, and URL sink safety

## Default path

1. Name the untrusted input source.
2. Name the dangerous sink it can reach.
3. Validate and normalize input once near entry.
4. Use sink-specific protection:
   - parameterized queries for SQL
   - context-appropriate escaping or encoding for HTML
   - path allowlists or fixed roots for filesystem access
   - no shell interpolation for command execution
   - redirect allowlists for outbound navigation
5. Keep raw attacker input away from privileged sinks when possible.

## When to deviate

- Use richer schema validation only when the domain actually needs structured coercion or refinement.
- Allow limited rich text only with a deliberate sanitization and rendering boundary.
- Use raw input logs sparingly and only with redaction when sensitive data may be present.

## Guardrails

- Validation is not generic string cleaning.
- Protection must match the sink, not just the input type.
- Normalize once; avoid multiple inconsistent parsing paths.
- Prefer avoiding dangerous sinks entirely when the feature design allows it.

## Avoid

- “sanitize everything” with no sink model
- string-concatenated SQL
- trusting file paths or redirect targets from raw input
- assuming one HTML sanitizer solves shell, SQL, and URL problems too

## Verification checklist

- source input is named
- dangerous sink is named
- validation and normalization happen once
- sink-specific protection is used
- raw attacker input is not flowing unchecked into privileged operations

## Output Shape

When answering with this skill, prefer:

- untrusted source
- dangerous sink
- required validation
- required sink-specific protection
- main exploit path if left unchanged

## References

- [Validation and sink defaults](./references/validation-and-sink-defaults.md)
