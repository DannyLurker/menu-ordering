// Public API boundary for the stay slice (scope folder structure).
// Outside code imports stay check in from here, never from slice files
// directly. The repository stays slice internal.
export {
  IDEMPOTENCY_SEC,
  LIST_PAGE,
  MAX_EXTRA_GUESTS,
  SETUP_ALPHABET,
  SETUP_CODE_LEN,
  SETUP_TTL_MIN,
  STAY_MAX_NIGHTS,
  StayCheckinError,
  createStay,
  generateSetupCode,
  hashSetupCode,
  isWeakPin,
  listRecentStays,
  maskGuestName,
  normalizeRoom,
  parseDateOnly,
  peekGuestStay,
  reissueSetupCode,
  setupStayPin,
  validateStayDates,
  type StayCreated,
} from "./services/stays.service";
export { createStayBody, pinSetupBody, type CreateStayInput, type PinSetupInput } from "./stays.schemas";
