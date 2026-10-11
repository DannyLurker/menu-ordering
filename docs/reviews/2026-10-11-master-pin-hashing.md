# Review, master, 2026-10-11 (PIN hashing)

**Reviewed by**: Muse Spark (author on Muse Spark, same model, degraded review, blind spots shared)
**Scope**: 5 files, uncommitted (feature 16, PIN hashing on bcryptjs)
**Verdict**: Approve with nits

## Summary

The change swaps hand rolled scrypt for bcryptjs with a prefix branched compat path and lazy row upgrade on first successful match. Branching, upgrade placement, failure paths, and spec 0005 conformance all hold up under tracing, and the new service tests pin the upgrade behavior against live rows. One minor maintainability note; no correctness or security findings.

## Minor
### 🟡 Derivation length constant unexplained, `lib/pin.ts:10`
**Problem**: `SCRYPT_KEY_LEN = 64` must exactly match the pre spec 0005 derivation length or every old row silently stops verifying, but nothing says so; a future cleanup could "simplify" it into a lockout.
**Why it matters**: the compat guarantee rests on one unexplained number surviving future edits.
**Suggested fix**: add a one line comment that 64 must match the original derivation length and old rows depend on it.

## Strengths
- The compat test fixture builds scrypt rows with raw Node crypto instead of the implementation under test, so the old format check cannot pass by construction accident.
- The wrong PIN on scrypt test asserts the row stays scrypt and the counter moves, proving failed attempts never trigger partial upgrades.
- The bcrypt branch fails closed inside try/catch, verified against malformed inputs.

## Test coverage
Covered: bcrypt format and cost, fresh salt, empty input throw, correct and wrong PIN on both formats, cross stay confusion, malformed rows, prefix branching, service level upgrade plus resolve plus revoke plus locked refusal plus unknown stay. Uncovered: nothing material; seed and prove callers run in verify.
