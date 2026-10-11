// Edge gates for staff identity (spec 0004). Every staff request passes
// here first; sensitive routes recheck server side in features/staff/.
// Unknown roles and expired sessions fall back to sign in, never to data.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/features/staff";
import { ROLE_HOME, type StaffRole } from "@/features/staff";

function roleOf(value: unknown): StaffRole | null {
  return value === "FRONT_DESK" || value === "KITCHEN" || value === "ADMIN" ? value : null;
}

interface EdgeUser {
  role: StaffRole | null;
  mustChangePassword: boolean;
  isDisabled: boolean;
  locked: boolean;
}

async function edgeUser(request: NextRequest): Promise<EdgeUser | null> {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    const raw = session?.user as
      | { role?: unknown; mustChangePassword?: unknown; isDisabled?: unknown; lockedUntil?: unknown }
      | undefined;
    if (!raw) return null;
    const lockedUntil = raw.lockedUntil instanceof Date ? raw.lockedUntil : null;
    return {
      role: roleOf(raw.role),
      mustChangePassword: raw.mustChangePassword === true,
      isDisabled: raw.isDisabled === true,
      locked: lockedUntil !== null && lockedUntil > new Date(),
    };
  } catch {
    return null;
  }
}

function redirect(request: NextRequest, to: string): NextResponse {
  return NextResponse.redirect(new URL(to, request.url));
}

function apiDenied(code: string, message: string, status: number): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

const ADMIN_API = ["/api/staff/reissue"];
const DESK_API = ["/api/stays/"];

function apiRole(pathname: string): StaffRole[] | "any" {
  if (pathname === "/api/staff" || ADMIN_API.some((p) => pathname.startsWith(p))) return ["ADMIN"];
  if (pathname.startsWith("/api/staff/") && !pathname.startsWith("/api/staff/me")) return ["ADMIN"];
  if (pathname.startsWith("/api/staff/me")) return "any";
  if (DESK_API.some((p) => pathname.startsWith(p))) return ["FRONT_DESK", "ADMIN"];
  return "any";
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");

  // Public auth surfaces own their limits and gates.
  if (pathname.startsWith("/api/auth/") || pathname.startsWith("/api/stay-session/")) {
    return NextResponse.next();
  }

  const user = await edgeUser(request);
  const valid = user && !user.isDisabled && !user.locked && user.role;

  if (isApi) {
    if (!valid) return apiDenied("UNAUTHORIZED", "Sign in required.", 401);
    const roles = apiRole(pathname);
    if (user.mustChangePassword && !pathname.startsWith("/api/staff/me")) {
      return apiDenied("MUST_CHANGE_PASSWORD", "Set a new password before continuing.", 403);
    }
    if (roles !== "any" && (!user.role || !roles.includes(user.role))) {
      return apiDenied("FORBIDDEN", "Your role cannot use this.", 403);
    }
    return NextResponse.next();
  }

  if (pathname === "/sign-in") {
    if (!valid) return NextResponse.next();
    if (user.mustChangePassword) return redirect(request, "/change-password");
    return redirect(request, ROLE_HOME[user.role ?? "FRONT_DESK"] ?? "/sign-in");
  }
  if (pathname === "/change-password") {
    if (!valid) return redirect(request, "/sign-in");
    return NextResponse.next();
  }
  if (pathname === "/") {
    if (!valid) return redirect(request, "/sign-in");
    if (user.mustChangePassword) return redirect(request, "/change-password");
    return redirect(request, ROLE_HOME[user.role ?? "FRONT_DESK"] ?? "/sign-in");
  }

  const home = (role: StaffRole): string => ROLE_HOME[role];
  const needs = (roles: StaffRole[]): boolean => !!valid && !!user.role && roles.includes(user.role);

  if (pathname.startsWith("/stays")) {
    if (!valid) return redirect(request, "/sign-in");
    if (user.mustChangePassword) return redirect(request, "/change-password");
    if (!needs(["FRONT_DESK", "ADMIN"])) return redirect(request, home(user.role ?? "KITCHEN"));
    return NextResponse.next();
  }
  if (pathname.startsWith("/kitchen")) {
    if (!valid) return redirect(request, "/sign-in");
    if (user.mustChangePassword) return redirect(request, "/change-password");
    if (!needs(["KITCHEN", "ADMIN"])) return redirect(request, home(user.role ?? "FRONT_DESK"));
    return NextResponse.next();
  }
  if (pathname.startsWith("/staff") || pathname.startsWith("/menu")) {
    if (!valid) return redirect(request, "/sign-in");
    if (user.mustChangePassword) return redirect(request, "/change-password");
    if (!needs(["ADMIN"])) return redirect(request, home(user.role ?? "FRONT_DESK"));
    return NextResponse.next();
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};
