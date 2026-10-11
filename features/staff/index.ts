// Public API boundary for the staff slice (scope folder structure).
// Outside code imports staff identity from here, never from slice files
// directly. The browser client is the one exception: `auth-client.ts` is a
// client boundary, so pages import it by path to keep it out of server
// bundles. The repository stays slice internal.
export { auth, STAFF_SESSION_HOURS, type AuthSession } from "../../lib/auth";
export {
  ROLE_HOME,
  STAFF_ROLES,
  isStaffRole,
  type StaffPublic,
  type StaffRole,
} from "./types";
export {
  NEXT_PASSWORD_MIN,
  createStaffBody,
  passwordBody,
  reissueBody,
  staffListQuery,
  staffRole,
  updateStaffBody,
} from "./schemas";
export {
  LOCK_MINUTES,
  LOCK_THRESHOLD,
  StaffError,
  changeStaffPassword,
  checkSignInAllowed,
  createStaffAccount,
  generateTempPassword,
  isValidEmail,
  listStaffAccounts,
  recordSignInFailure,
  recordSignInSuccess,
  reissueTempPassword,
  toStaffPublic,
  updateStaffAccount,
} from "./services/staff-service";
export {
  getStaffUser,
  getStaffUserWithFlags,
  requireStaffRole,
  type StaffGate,
  type StaffUser,
} from "./staff-auth";
