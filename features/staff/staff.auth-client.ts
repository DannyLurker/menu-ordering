// Staff identity client (spec 0004). Browser side auth calls stay here;
// server code uses lib/auth.ts `auth.api` instead. Base path matches the
// BetterAuth route at app/api/auth/[...all].
"use client";

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: typeof window === "undefined" ? undefined : window.location.origin,
});
