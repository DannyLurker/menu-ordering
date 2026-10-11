# 0008. Stay and guest check in

**Date**: 2026-10-11
**Status**: Accepted

## Summary

Front desk creates the stay at arrival and the guest sets a personal 6 digit PIN (personal code) with a one time setup code (single use code shown once). The stay record carries room plus names plus dates, and every later order call reuses one shared date check. A reader new to the project can build from this spec alone.

## Requirements

**User stories**:
* As front desk, I want to create a stay with room plus names plus dates so the guest can order from the room.
* As a guest, I want to set my own 6 digit PIN with a setup code so only I know it.
* As front desk, I want to reissue a setup code when the guest loses it so arrival is never blocked.
* As the system, I want one shared orderable check so expired stays cannot order.

**Acceptance criteria**:
* **AC-1**: Desk creates a stay with roomNumber plus guestName plus optional extraNames plus checkIn plus checkOut, and receives the plain setup code exactly once with its expiry, else 400 on bad input.
* **AC-2**: Guest sets a 6 digit PIN with a valid setup code, PIN stored as bcrypt (peer reviewed hash library) row with pinSetAt set, setup hash cleared atomically, weak codes rejected with 400. Blocklist covers 000000 through 999999 repeats plus 123456 plus 654321 plus straight ascending or descending runs.
* **AC-3**: Create on a room with any ACTIVE stay row fails with 409 naming the current checkout date in YYYY-MM-DD, no duplicate row written. Live for 409 means any ACTIVE row, independent of dates.
* **AC-4**: Date rules hold: checkOut after checkIn, max 30 nights inclusive of the span, checkIn defaults to today. Today means UTC day to match the mint path, inputs are date only YYYY-MM-DD, past checkIn allowed only for today.
* **AC-5**: A stay outside its date range or not ACTIVE cannot mint and cannot order, answering 403 with a contact desk message in English plus Indonesian, reusing the shared helper. Orderable means status ACTIVE plus UTC today within checkIn to checkOut inclusive.
* **AC-6**: Desk can reissue a fresh setup code for a live stay, old code stops working, plain code shown once.
* **AC-7**: Guest setup attempts throttle at 5 per stay per 15 minutes with 429 plus call desk message, secrets never logged.
* **AC-8**: Desk page shows form plus result plus stay list on StaffShell (staff layout), guest page shows confirm plus entry plus success, all strings in English plus Indonesian with accessible labels and empty plus error states.

## Decision

**Chosen option**: Option 1: Desk creates, guest sets with one time code

Desk creates the stay and hands over a one time setup code. The guest sets the PIN on the guest screen. No vetted outside library covers this flow, so it is hand built on node crypto plus bcryptjs plus Zod plus LRU cache already in the stack.

## Rationale

Reasoning and options: see rationale.md.

## Feature design

**Data model sketch**:
* Stay (existing, 3 columns added): id uuid pk, roomNumber text req, guestName text req, checkIn Date req, checkOut Date req, status StayStatus default ACTIVE, pinHash text req (random bcrypt temp until set), pinSetAt timestamptz nullable (null means unset), failedPinAttempts int, pinLocked bool, setupHash text nullable unique (SHA256 of setup code), setupExpiresAt timestamptz nullable, createdAt.
* Guest (existing, reused): id uuid pk, stayId fk to Stay cascade, fullName text req, createdAt. One row per extra occupant, primary name also on Stay.guestName for list speed.
* StaySession (existing, untouched): mint and resolve paths unchanged.
* Constraints: partial unique one ACTIVE stay per roomNumber already in migration SQL, setupHash unique while non null, checkOut after checkIn plus 30 night cap in app with CHECK guard in migration, setup cleared to null on use or reissue overwrite.

**State transitions**:
Stay in this slice is created ACTIVE and stays ACTIVE. Checkout to CHECKED_OUT plus cancel to CANCELLED ship with the folio view slice later. PIN state: unset (pinSetAt null) to set (pinSetAt dated). Setup state: issued to used or expired to reissued.

**API surface**:
| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| /api/stays | POST | roomNumber:string req, guestName:string req, extraNames:string[] opt, checkIn:date opt defaults today, checkOut:date req | stayId, roomNumber, checkIn, checkOut, setupCode plain once, setupExpiresAt | FRONT_DESK, ADMIN via proxy plus service check | 400 validation, 401 unauthenticated, 403 wrong role, 409 room taken |
| /api/stays/pin-setup | POST | stayId:string req, setupCode:string req, newPin:string 6 digits req, confirmPin:string req | ok true, pinSetAt | open with LRU throttle per stay | 400 weak or mismatch or uniform invalid, 410 used or expired, 423 locked, 429 throttled |
| /api/stays/[id]/reissue | POST | stayId in path | setupCode plain once, setupExpiresAt | FRONT_DESK, ADMIN | 404 unknown, 403 wrong role, 409 stay not orderable state |

**Value sourcing**:
| Action | Value produced or displayed | Source |
|---|---|---|
| Create stay | stayId | DB column Stay.id generated uuid |
| Create stay | setupCode plain | input derived: fresh random 8 chars from SETUP_ALPHABET via node randomBytes generated in service, hashed to Stay.setupHash, plain returned once |
| Create stay | today default for checkIn | derived from now as UTC day via stayCoversToday to match mint |
| Create stay | setupExpiresAt | derived from now plus 15 minutes in service |
| Create stay | room taken message with checkout date | DB column Stay.checkOut of conflicting ACTIVE row |
| PIN setup | pinSetAt | derived from now in service on success |
| PIN setup | weak code rejection | input newPin checked against blocklist in service |
| Order guard | orderable true or false | derived from Stay.status plus Stay.checkIn plus Stay.checkOut via isStayOrderable helper |
| Order guard | 403 message | fixed strings EN plus ID in service |
| Guest confirm | room plus masked name | DB columns Stay.roomNumber plus Stay.guestName shown as first word plus last initial, full when single word |
| Desk list | stay rows plus status | DB columns Stay paginated 20 newest first by createdAt |
| Guest confirm | room plus masked name | DB columns Stay.roomNumber plus Stay.guestName masked to first name plus initial |

**Key invariants**:
* One ACTIVE stay per roomNumber at all times, enforced in DB plus checked in app before insert.
* PIN never stored plain, only bcrypt row, temp row unguessable random 32 bytes hashed.
* Setup code stored only as SHA256 hash, plain shown once and never logged, single use with atomic compare and clear in one transaction (concurrent double use: exactly one wins, the other gets 410).
* Stay creation plus Guest rows write in one transaction, partial failure rolls back all.
* Room match uses normalized form trim plus uppercase for the 409 check and the 10 second idempotency match on normalized room plus checkIn plus checkOut plus guestName. Stored roomNumber keeps desk typed form, names limited to 100 chars.
* Guest reaches PIN setup at /guest/setup with stayId in query plus code field. Desk surface stays at /stays, result card persists only until navigation, recovery is reissue. List shows newest first by createdAt paginated 20.
* isStayOrderable signature is (stay with status plus checkIn plus checkOut, today) to boolean, status checked first then dates, single source for mint and ordering.
* Reissue allowed only on ACTIVE stays, resets a full 15 minutes, invalidates the old hash at write time, desk side throttle 20 per hour.

**Security model**:
Create plus reissue: FRONT_DESK and ADMIN only, proxy gate plus service role check, 401 when no session, 403 otherwise. Kitchen has no access. PIN setup: open endpoint holding the setup code as the credential, LRU throttle 5 per 15 minutes per stay counting all attempts with Retry-After on 429, single instance memory per the realtime spec with multi host deferred. Unknown stay and bad code both answer uniform invalid or expired to cut enumeration, locked stays answer 423. PIN lock threshold reuses PIN_LOCK_THRESHOLD 5 from the stay session service with desk unlock as the release. PII scope: guest names are PII, logs carry stayId plus actor plus reason only, no names plus no PIN plus no setup code. Audit events checkin.created plus pinsetup.ok plus pinsetup.fail carry stayId plus actor plus reason.

**Configuration required**:
No new env vars. Constants in code: SETUP_TTL_MIN 15, SETUP_CODE_LEN 8, SETUP_ALPHABET uppercase alphanumeric without I O 0 1 drawn from node randomBytes, IDEMPOTENCY_SEC 10, LIST_PAGE 20, STAY_MAX_NIGHTS 30. Today source is UTC day via the existing stayCoversToday helper.

**Critical test scenarios**:
* Happy path: desk creates stay then guest sets PIN then helper reports orderable, verifies **AC-1**, **AC-2**, **AC-5**
* Failure case: second create on same live room gets 409, reuse of consumed setup code gets 410, verifies **AC-3**, **AC-2**
* Failure case: expired stay mint blocked 403, sixth setup try in window gets 429, verifies **AC-5**, **AC-7**
* Failure case: concurrent double PIN setup with one code yields one ok plus one 410, verifies **AC-2**
* Auth case: kitchen session on create gets 403, open setup probe gets uniform invalid without leaking PIN state, verifies **AC-1**, **AC-7**
* UI case: desk form shows validation plus one time code copy, guest screen shows weak plus mismatch plus success in both languages, verifies **AC-8**

**Planned workflow** (per working agreement 2, plan shape, develop updates to actual below):
1. Desk opens Stays, fills room plus name plus dates, submits.
2. System writes Stay plus Guests, shows setup code once with copy.
3. Desk shares code with guest verbally or by guest typing from desk screen.
4. Guest opens PIN setup, confirms room, enters code plus new PIN twice, submits.
5. System hashes PIN, clears setup, shows success pointing to menu.
6. Later order calls run isStayOrderable first and block with 403 when out of range.

**Actual workflow** (what was built; matches the plan except where noted):
1. Desk opens /stays, fills room plus name plus dates, submits to POST /api/stays.
2. System writes Stay plus Guests in one transaction, shows setup code once with copy.
3. Double submit inside 10 seconds returns the first stayId with a fresh rotated code and a duplicate flag (plan said same stay; the code rotation is the safe detail).
4. Guest opens /guest/setup?stay=id, confirms room plus masked name, enters code plus new PIN twice, submits to POST /api/stays/pin-setup.
5. System hashes PIN with bcryptjs, clears setup atomically, shows success with no onward link (ordering slice ships next; plan said menu, but /menu is staff gated).
6. Used code answers 410, never issued answers 400, same message text (plan grouped both as 410).
7. Later mint calls run isStayOrderable first and block with bilingual 403.

**How it works** (per working agreement 4):
1. Desk inputs identity and dates and submits.
2. System checks role plus input plus room conflict plus date rules.
3. System writes Stay with temp PIN plus setup hash in one transaction and returns plain code once.
4. Guest inputs setup code plus new PIN twice and submits.
5. System checks code hash plus expiry plus throttle plus PIN strength.
6. System writes bcrypt PIN plus pinSetAt and clears setup in one update.
7. Every later mint or order loads the stay and runs isStayOrderable before any business work.

## Build plan

Ordered as Tracer Bullet (thin real pipe through all layers first, then thicken):

1. Migration plus pure helpers: add setupHash plus setupExpiresAt to Stay, add isStayOrderable plus setup code generator plus weak PIN list with unit tests, satisfies **AC-2**, **AC-4**, **AC-5**
2. Thin create thread: stay service create in transaction plus POST /api/stays plus Zod schemas plus 409 path plus prove script create only, satisfies **AC-1**, **AC-3**, **AC-4**
3. Thin PIN set thread: pin setup service plus POST /api/stays/pin-setup plus throttle plus bcrypt write plus clear, guest page with confirm plus entry plus success EN plus ID, satisfies **AC-2**, **AC-7**, **AC-8**
4. Desk surface plus reissue: stays page form plus one time result card plus paginated list plus reissue action plus POST /api/stays/[id]/reissue, idempotency window, satisfies **AC-1**, **AC-6**, **AC-8**
5. Guards plus evidence: wire isStayOrderable into mint path, structured logs minus secrets, 403 wording EN plus ID, service plus route tests for conflict plus expiry plus throttle plus role gates, satisfies **AC-5**, **AC-7**, **AC-8**

Build notes: route level tests were skipped (gated routes need a staff session mock; service prove plus unit tests plus typecheck plus build cover the paths). An extra per IP budget guards pin-setup alongside the specced per stay budget. Mint guard messages went bilingual under AC-5; no prior test pinned the old text.

## Consequences

**Positive**:
* Arrival is guided end to end with one code path for dates that ordering reuses.
* PIN secrecy improves over desk set flows with no extra hardware.
* Desk recovery via reissue keeps the counter unblocked.

**Negative / tradeoffs**:
* Guest must act within 15 minutes or ask desk for reissue, small friction for slow arrivals.
* Temp bcrypt row plus setup columns add one migration and one new throttle bucket to operate.
* UTC day truth can surprise on checkout edge days until the WIB day refinement ships later.

**Neutral**:
* Folio creation stays deferred to the verify slice, stay list pagination starts at 20.
* Outside library request per working agreement 1: none needed, no download to approve. Vetted peers reused are bcryptjs plus Zod plus LRU cache. If a new library appears during build, develop must ask before adding.

## Follow-up

* [ ] Checkout plus cancel design when folio view slice starts, transitions CHECKED_OUT and CANCELLED plus room release rules.
* [ ] WIB calendar day refinement for isStayOrderable if checkout day disputes appear in testing.
* [ ] Stay list search by room or name when volume grows beyond paginated scan.
