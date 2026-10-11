// Staff identity server (spec 0004). BetterAuth 1.7 with email plus
// password and 12 hour cookie sessions. Public sign up is disabled:
// staff accounts are created by admins through app/api/staff only.
import "dotenv/config";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "./db";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Copy .env.example to .env and set it before running.`);
  }
  return value;
}

export const STAFF_SESSION_HOURS = 12;

export const auth = betterAuth({
  appName: "Biz Hotel Batam Menu Ordering",
  secret: requiredEnv("BETTER_AUTH_SECRET"),
  baseURL: process.env.BETTER_AUTH_URL,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    requireEmailVerification: false,
    autoSignIn: false,
    minPasswordLength: 10,
    maxPasswordLength: 128,
  },
  session: {
    expiresIn: 60 * 60 * STAFF_SESSION_HOURS,
    updateAge: 60 * 60 * (STAFF_SESSION_HOURS / 2),
    cookieCache: { enabled: false },
  },
  user: {
    additionalFields: {
      role: { type: "string", required: true, input: false },
      failedSignInAttempts: { type: "number", required: false, input: false },
      lockedUntil: { type: "date", required: false, input: false },
      mustChangePassword: { type: "boolean", required: false, input: false },
      isDisabled: { type: "boolean", required: false, input: false },
    },
  },
  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
