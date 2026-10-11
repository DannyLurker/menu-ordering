# Rationale: 0008 stay and guest check in

## Context

Guests order from the room only while their stay is live. Today the Stay table plus the mint and unlock paths exist from prior specs, but there is no guided way to create a stay at the counter and no safe way for the guest to choose a PIN. The desk page shows a placeholder that says check in arrives later.

Forces at play: the counter must stay fast even with a queue, the PIN must stay secret with the guest, the one ACTIVE stay per room rule must hold, and ordering in the next slice must have a single date truth to call. PII (guest names) flows through this feature, so logging must avoid names. No new infrastructure is wanted. The team chose Tracer Bullet (thin working pipe first, then thicken), so this spec orders a thin real loop before polish.

## Options considered

### Option 1: Desk creates, guest sets with one time code

Desk creates the stay, system shows a short lived code once, guest enters it on their own device to choose a PIN. Temp PIN at creation is random and unusable.

**Pros**:
* Secret stays with the guest, desk never knows the PIN
* No printer needed, code shown once on the desk screen

**Cons**:
* Guest needs a device moment after arrival, expiry can bite if they wait

### Option 2: Desk sets PIN directly

Desk types the PIN at the counter and hands it over verbally or on paper.

**Pros**:
* Fastest counter flow, no second step

**Cons**:
* PIN is seen and heard by staff and others, weaker secrecy, paper slips leak

### Option 3: Activate prebooked stays only

Stays arrive from a booking import, check in only flips status.

**Pros**:
* No typing at arrival, good for high volume hotels

**Cons**:
* Needs an import pipe that does not exist, overbuilt for V1.1, still needs a PIN step

## Rationale

Counter speed plus secrecy plus reuse drove the call. Option 1 keeps the counter interaction to one form while the secret is born on the guest device, which matches the auth spec pattern where tokens hash with SHA256 (one way fingerprint) and PINs hash with bcryptjs. Option 2 leaks the secret at the busiest moment. Option 3 assumes an import system outside V1.1 scope. The one time code with 15 minute expiry bounds the window without punishing guests who reach the room a little late, and reissue covers the rest.

RECOMMEND calls made here with runner up noted: setup code is 8 chars uppercase alphanumeric without confusing chars (readable on a desk screen, runner up was 6 digit numeric which reads like a second PIN), idempotency window 10 seconds on room plus dates (runner up was none, rejected because double click would mint duplicate stays), stay list paginates at 20 newest first (runner up was unpaginated, rejected per list must paginate practice), date truth stays UTC day to match stayCoversToday with WIB noon kept only for session expiry (runner up was full WIB day, deferred to keep mint and order consistent), guest names treated as PII and never logged (runner up was full payload logs, rejected).
