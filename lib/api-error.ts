// Consistent API error shape (spec 0004). Wrong credentials always get a
// generic message that names neither the account nor the field.
export interface ApiErrorBody {
  error: { code: string; message: string };
}

export function apiError(code: string, message: string, status: number): Response {
  const body: ApiErrorBody = { error: { code, message } };
  return Response.json(body, { status });
}

export const GENERIC_CREDENTIALS_MESSAGE = "Invalid email or password.";
export const GENERIC_LOCKED_MESSAGE = "Too many attempts. Try again later.";
export const GENERIC_PIN_MESSAGE = "Wrong PIN. Try again.";
