// Public API boundary for the stay session slice (scope folder structure).
// Outside code imports guest stay identity from here, never from slice
// files directly. The repository stays slice internal.
export {
  PIN_LOCK_THRESHOLD,
  STAY_COOKIE,
  STAY_MAX_DAYS,
  STAY_TOKEN_BYTES,
  StayAuthError,
  checkoutExpiry,
  hashStayToken,
  isStayOrderable,
  mintStaySession,
  peekStay,
  readStayToken,
  resolveStaySession,
  revokeStaySession,
  revokeStaySessionsForStay,
  stayCookieOptions,
  stayCoversToday,
  unlockStay,
  type StayMint,
} from "./services/stay-session.service";
export { hashPin, verifyPin } from "../../lib/pin";
export { mintBody } from "./stay-session.schemas";
