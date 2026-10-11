# 0009. Guest order with PIN verify · Rationale

**Date**: 2026-10-11

## Context

In Biz Hotel Batam, guests place room service orders directly from their mobile phones or in room devices. While the guest device maintains an active session cookie established at check in, room devices can be accessible to multiple individuals, visitors, or children. The hotel needs a mechanism to ensure that orders charged to a room folio are intentionally authorized by the primary guest who holds the 6 digit check in PIN.

At the same time, the solution must safeguard against guessing attacks. A room PIN consists of 6 digits, giving one million combinations. Without strict rate limiting and lockout counters, an automated attacker or unauthorized person could guess the PIN. The system already implements a PIN failure counter and lock threshold of 5 attempts for stay session check in minting (defined in spec 0004 and spec 0008). The ordering flow must decide whether to share this counter, use an independent counter, or trust the session cookie alone.

Furthermore, menu ordering introduces financial transactions. Orders placed by guests must freeze menu pricing at the instant of placement, prevent double ordering when guests tap repeatedly on slow connections, and guarantee that item quantities and availability are validated before any database record is created.

## Options considered

### Option 1: Combined cookie session plus PIN verification with shared stay lockout counter

Guests authenticate with their active stay cookie, and each order submission requires entering their 6 digit room PIN. The backend validates stay validity, checks the PIN against bcrypt, increments the existing stay failure counter on mismatch, and locks the stay on the fifth strike. Orders are saved atomically in PostgreSQL with price snapshots taken from the database. An in memory LRU cache prevents duplicate submissions within a 10 second window.

**Pros**:
* Maximum security against unauthorized orders on shared or left open devices.
* Reusing the stay failure counter prevents attackers from exploiting ordering as an alternative brute force vector.
* Database price snapshotting prevents pricing discrepancies if staff edits prices while guests are browsing.
* Pure database transactions guarantee either the entire order with line items succeeds or nothing is written.

**Cons**:
* Adds a short PIN entry step to every order submission flow.
* A guest who forgets their PIN during ordering locks their stay check in session after 5 mistakes, requiring front desk help.

### Option 2: Trust active cookie session without PIN re-entry at checkout

Guests authenticate once when entering the guest portal. Subsequent order placement relies entirely on the HTTP only session cookie without prompting for the 6 digit PIN again.

**Pros**:
* Frictionless one tap ordering experience for the guest.
* No risk of PIN lockout during food ordering.

**Cons**:
* Any person with physical access to the room device can order food and accumulate room charges without authorization.
* Violates the explicit scope requirement for PIN verification at order time.

### Option 3: Separate ordering PIN counter with temporary endpoint rate limit

Guests must enter the 6 digit PIN, but wrong attempts are counted in an isolated counter that only blocks food ordering for 15 minutes, without locking the main room stay.

**Pros**:
* Less disruptive if a guest enters the wrong PIN while ordering; their room check in session remains unlocked.

**Cons**:
* Introduces split state where an attacker can try 4 guesses on check in and 4 guesses on ordering, increasing the attack surface.
* Increases schema and operational complexity by maintaining dual lockout states.

## Rationale

Option 1 is selected because it directly aligns with the agreed project scope and provides necessary defense in depth for room folio charges.

In a hotel environment, charges accumulated through room service are billed to the guest folio at checkout. Requiring the 6 digit PIN at the checkout modal ensures that only the guest who completed initial arrival verification can place charges on the room.

Reusing the stay level failure counter and lock threshold of 5 attempts is crucial. Having a single shared counter ensures that brute force attempts cannot be distributed across different endpoints to bypass security rules. When 5 incorrect entries occur across check in and ordering, the stay is locked, all active sessions are revoked, and the front desk must verify guest identity before unlocking the stay.

Taking price snapshots from the active database menu items at order time protects both the guest and the kitchen against unexpected price adjustments. The 10 second in memory deduplication window prevents accidental double orders resulting from network delays or rapid button taps.

