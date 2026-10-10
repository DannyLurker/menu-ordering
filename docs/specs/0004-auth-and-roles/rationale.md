# 0004. Auth and roles: rationale

## Context

The app serves four actors with different powers: front desk staff who check guests in, kitchen staff who verify orders, admins who manage menu and staff, and guests who order from the room. Today nothing proves who is asking: no sign in exists, no role gates exist, and the stay PIN from the data model has no session behind it. Every coming slice (check in, ordering, kitchen board, folio, menu management) needs to trust an identity, so this decision must land before Slice 1. The stack already fixes the building blocks (BetterAuth 1.7 for staff identity, Prisma 7 with Postgres for storage, LRU cache for free limiting, cookie sessions), and the data model already fixes the PIN side (scrypt hash, five miss lock, lock flag). The open questions are the role mechanism, the guest session shape, the gate enforcement points, and the account lifecycle around them.

## Options considered

### Option 1: BetterAuth roles plus a stay session table

Staff on BetterAuth email plus password with a required role column; guests on a server side stay session table with hashed tokens; edge gates plus server side rechecks.

**Pros**:

- Proven password and session handling with no hand rolled secrets.
- Server side guest sessions revoke at checkout and lock, unlike sealed cookies.
- One role column keeps the permission model readable for three roles.

**Cons**:

- Two session systems to understand (BetterAuth plus stay sessions).
- One live session per stay blocks a second device until sign out.

### Option 2: BetterAuth defaults plus a sealed guest cookie

Staff as in Option 1; guests carry a sealed cookie with the stay id and no server row.

**Pros**:

- Fewest moving parts and no extra table.
- No session storage to manage for guests.

**Cons**:

- Checkout and PIN lock cannot revoke a sealed cookie; expiry is the only lever.
- Cookie size and sealing key handling add their own pitfalls.

### Option 3: BetterAuth admin plus organization plugins

Staff roles through the admin plugin with permissions, guests through organization membership per stay.

**Pros**:

- Managed roles, bans, and impersonation out of the box.
- Permission lists scale past three roles without schema edits.

**Cons**:

- Organization machinery for a single hotel is overkill with concepts nobody else needs.
- Guest stays shoehorned into organizations distort a clean stay model.

## Rationale

You need revocation at checkout and lock, which rules out sealed cookies, so Option 2 fails the core guest story. The team is three roles in one hotel, so the organization plugin in Option 3 buys machinery nobody will use while complicating the clean stay model from spec 0002. Option 1 keeps the boring proven core (BetterAuth for everything it already does) and adds exactly one small table for the one thing BetterAuth does not model: a stay bound guest session with server side revocation. The single session per stay tradeoff is conscious and matches how rooms work (one bill, one session), with sign out as the escape hatch.
