// Custom server: one shared HTTP server for pages plus APIs plus live
// sockets (spec 0001, entrypoint stays server.ts). Realtime rooms plus
// joins live here (spec 0007): one room per stay plus one kitchen room,
// cookie verified joins, server emitted order events only.
import { createHash } from "node:crypto";
import { createServer } from "http";
import next from "next";
import { Server, type Socket } from "socket.io";
import { prisma } from "./lib/db";
import { auth } from "./lib/auth";
import {
  JOIN_DENIED,
  JOIN_KITCHEN,
  JOIN_STAY,
  KITCHEN_ROOM,
  LEAVE_KITCHEN,
  LEAVE_STAY,
  ORDER_CREATED,
  ORDER_STATUS_CHANGED,
  RATE_LIMIT_CODE,
  STAY_COOKIE,
  joinDenied,
  stayRoom,
  type JoinResult,
} from "./lib/realtime";
import { setRealtimeServer } from "./lib/realtime-server";
import {
  MINT_IP_MAX,
  MINT_STAY_MAX,
  SIGN_IN_ACCOUNT_MAX,
  SIGN_IN_IP_MAX,
  isRateLimited,
  hitRateLimit,
  mintIpKey,
  mintStayKey,
  rateLimitRetryAfter,
  signInAccountKey,
  signInIpKey,
} from "./lib/rate-limit";

const app = next({ dev: process.env.NODE_ENV !== "production" });
const port = Number(process.env.PORT || "3000");
const handler = app.getRequestHandler();

type Role = "FRONT_DESK" | "KITCHEN" | "ADMIN";

function roleOf(value: unknown): Role | null {
  return value === "FRONT_DESK" || value === "KITCHEN" || value === "ADMIN"
    ? value
    : null;
}

function parseCookies(raw: string | undefined): Record<string, string> {
  const jar: Record<string, string> = {};
  if (!raw) return jar;
  for (const part of raw.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (name && !(name in jar)) jar[name] = decodeURIComponent(value);
  }
  return jar;
}

function headerOf(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | null {
  const value = headers[name];
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

function socketIp(socket: Socket): string {
  const forwarded = headerOf(socket.handshake.headers, "x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = headerOf(socket.handshake.headers, "x-real-ip");
  if (realIp?.trim()) return realIp.trim();
  return socket.handshake.address || "unknown";
}

function hashStayToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

interface StayJoin {
  stayId: string;
}

/** Stay cookie to stay id, or null when missing, revoked, or expired. */
async function resolveStay(cookie: string | undefined): Promise<StayJoin | null> {
  if (!cookie) return null;
  try {
    const row = await prisma.staySession.findUnique({
      where: { tokenHash: hashStayToken(cookie) },
      include: { stay: { select: { id: true, status: true, pinLocked: true } } },
    });
    if (!row || row.revoked || row.expiresAt <= new Date()) return null;
    if (row.stay.status !== "ACTIVE" || row.stay.pinLocked) return null;
    return { stayId: row.stay.id };
  } catch {
    return null;
  }
}

interface StaffJoin {
  email: string;
  role: Role;
}

/** Staff cookie to role identity, mirroring the edge gate in proxy.ts. */
async function resolveStaff(cookieHeader: string): Promise<StaffJoin | null> {
  try {
    const session = await auth.api.getSession({
      headers: new Headers({ cookie: cookieHeader }),
    });
    const raw = session?.user as
      | {
          email?: unknown;
          role?: unknown;
          mustChangePassword?: unknown;
          isDisabled?: unknown;
          lockedUntil?: unknown;
        }
      | undefined;
    if (!raw || typeof raw.email !== "string") return null;
    const role = roleOf(raw.role);
    if (!role) return null;
    if (raw.mustChangePassword === true || raw.isDisabled === true) return null;
    const lockedUntil = raw.lockedUntil instanceof Date ? raw.lockedUntil : null;
    if (lockedUntil !== null && lockedUntil > new Date()) return null;
    return { email: raw.email, role };
  } catch {
    return null;
  }
}

type Ack = (result: JoinResult) => void;

function answer(socket: Socket, ack: unknown, result: JoinResult): void {
  if (typeof ack === "function") (ack as Ack)(result);
  if (!result.ok) socket.emit(JOIN_DENIED, { code: result.code, retryAfterSec: result.retryAfterSec });
}

app.prepare().then(() => {
  const httpServer = createServer(handler);
  const io = new Server(httpServer);
  setRealtimeServer(io);

  io.on("connection", (socket) => {
    const ip = socketIp(socket);
    const rawCookie = headerOf(socket.handshake.headers, "cookie") ?? "";
    const jar = parseCookies(rawCookie || undefined);

    socket.on(JOIN_STAY, async (ack: unknown) => {
      if (isRateLimited(mintIpKey(ip), MINT_IP_MAX)) {
        console.log(`[realtime] deny join ip=${ip} reason=limited`);
        answer(socket, ack, joinDenied(RATE_LIMIT_CODE, rateLimitRetryAfter(mintIpKey(ip), MINT_IP_MAX)));
        return;
      }
      hitRateLimit(mintIpKey(ip), MINT_IP_MAX);
      const stay = await resolveStay(jar[STAY_COOKIE]);
      if (!stay) {
        // Pre auth hammering is keyed by socket id so one connection
        // cannot probe forever and real stay budgets stay clean.
        const probeKey = `join:sock:${socket.id}`;
        if (isRateLimited(probeKey, MINT_STAY_MAX)) {
          answer(socket, ack, joinDenied(RATE_LIMIT_CODE, rateLimitRetryAfter(probeKey, MINT_STAY_MAX)));
          return;
        }
        hitRateLimit(probeKey, MINT_STAY_MAX);
        console.log(`[realtime] deny join ip=${ip} reason=no-session`);
        answer(socket, ack, joinDenied("NO_SESSION", 0));
        return;
      }
      if (isRateLimited(mintStayKey(stay.stayId), MINT_STAY_MAX)) {
        console.log(`[realtime] deny join stay=${stay.stayId} reason=limited`);
        answer(
          socket,
          ack,
          joinDenied(RATE_LIMIT_CODE, rateLimitRetryAfter(mintStayKey(stay.stayId), MINT_STAY_MAX)),
        );
        return;
      }
      hitRateLimit(mintStayKey(stay.stayId), MINT_STAY_MAX);
      const room = stayRoom(stay.stayId);
      await socket.join(room);
      console.log(`[realtime] join room=${room} stay=${stay.stayId}`);
      answer(socket, ack, { ok: true, room });
    });

    socket.on(JOIN_KITCHEN, async (ack: unknown) => {
      if (isRateLimited(signInIpKey(ip), SIGN_IN_IP_MAX)) {
        console.log(`[realtime] deny kitchen ip=${ip} reason=limited`);
        answer(socket, ack, joinDenied(RATE_LIMIT_CODE, rateLimitRetryAfter(signInIpKey(ip), SIGN_IN_IP_MAX)));
        return;
      }
      hitRateLimit(signInIpKey(ip), SIGN_IN_IP_MAX);
      const staff = await resolveStaff(rawCookie);
      if (!staff) {
        const probeKey = `join:sock:${socket.id}`;
        if (isRateLimited(probeKey, SIGN_IN_ACCOUNT_MAX)) {
          answer(socket, ack, joinDenied(RATE_LIMIT_CODE, rateLimitRetryAfter(probeKey, SIGN_IN_ACCOUNT_MAX)));
          return;
        }
        hitRateLimit(probeKey, SIGN_IN_ACCOUNT_MAX);
        console.log(`[realtime] deny kitchen ip=${ip} reason=no-session`);
        answer(socket, ack, joinDenied("NO_SESSION", 0));
        return;
      }
      if (staff.role !== "KITCHEN" && staff.role !== "ADMIN") {
        console.log(`[realtime] deny kitchen ip=${ip} reason=role`);
        answer(socket, ack, joinDenied("FORBIDDEN", 0));
        return;
      }
      const accountKey = signInAccountKey(staff.email);
      if (isRateLimited(accountKey, SIGN_IN_ACCOUNT_MAX)) {
        console.log(`[realtime] deny kitchen ip=${ip} reason=limited`);
        answer(socket, ack, joinDenied(RATE_LIMIT_CODE, rateLimitRetryAfter(accountKey, SIGN_IN_ACCOUNT_MAX)));
        return;
      }
      hitRateLimit(accountKey, SIGN_IN_ACCOUNT_MAX);
      await socket.join(KITCHEN_ROOM);
      console.log(`[realtime] join room=${KITCHEN_ROOM} role=${staff.role}`);
      answer(socket, ack, { ok: true, room: KITCHEN_ROOM });
    });

    socket.on(LEAVE_STAY, async () => {
      const stay = await resolveStay(jar[STAY_COOKIE]);
      if (stay) await socket.leave(stayRoom(stay.stayId));
    });

    socket.on(LEAVE_KITCHEN, async () => {
      await socket.leave(KITCHEN_ROOM);
    });

    // Clients never emit order state (AC-4). Anything arriving here is
    // ignored and logged with the socket id only, never rebroadcast.
    socket.on(ORDER_CREATED, () => {
      console.log(`[realtime] ignore client emit event=${ORDER_CREATED} socket=${socket.id}`);
    });
    socket.on(ORDER_STATUS_CHANGED, () => {
      console.log(`[realtime] ignore client emit event=${ORDER_STATUS_CHANGED} socket=${socket.id}`);
    });

    socket.on("disconnect", () => {
      console.log(`[realtime] disconnect socket=${socket.id}`);
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });

  const shutdown = (signal: string) => {
    console.log(`Received ${signal}, closing server.`);
    setRealtimeServer(null);
    io.close();
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
});
