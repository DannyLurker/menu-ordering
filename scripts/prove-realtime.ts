// Prove walk for spec 0007 realtime foundation and rate limiting.
// Boots a scratch custom server (fresh LRU budgets every boot, socket
// rooms live here, not in `next start`), then walks: denied joins with
// no cookie, client emitted order state ignored, join probe budgets,
// REST 429 shape with retry timing, secret free denies, plus positive
// stay and kitchen joins on real sessions. Order fanout itself lands
// with slice 7, which calls the emit helper this walk cannot reach from
// here; the helper shape is locked by unit tests beside the source.
// Usage: `next build` first when app code changed, then:
// pnpm tsx scripts/prove-realtime.ts
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { createRequire } from "node:module";
import { dirname, join as joinPath } from "node:path";
import { randomUUID } from "node:crypto";
import { hash as bcryptHash } from "bcryptjs";
import { io as ioClient, type Socket } from "socket.io-client";
import { prisma } from "../lib/db";
import { hashPin } from "../lib/pin";
import type { JoinResult } from "../lib/realtime";

const PORT = 3122;
const ORIGIN = `http://localhost:${PORT}`;
const PROVE_PIN = "482916";
const KITCHEN_PASSWORD = "Prove-Kitchen-12345";
const DESK_PASSWORD = "Prove-Desk-12345";

let failures = 0;

function check(name: string, cond: boolean, extra = ""): void {
  if (cond) {
    console.log(`ok: ${name}`);
  } else {
    failures += 1;
    console.log(`FAIL: ${name}${extra ? ` (${extra})` : ""}`);
  }
}

class Jar {
  private store = new Map<string, string>();
  get header(): string {
    return [...this.store.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  save(res: Response): void {
    const getSetCookie = (
      res.headers as Headers & { getSetCookie?: () => string[] }
    ).getSetCookie;
    const setCookies: string[] =
      typeof getSetCookie === "function" ? getSetCookie.call(res.headers) : [];
    for (const line of setCookies) {
      const pair = line.split(";")[0];
      const eq = pair.indexOf("=");
      if (eq > 0) {
        const name = pair.slice(0, eq).trim();
        const value = pair.slice(eq + 1).trim();
        if (value) this.store.set(name, value);
        else this.store.delete(name);
      }
    }
  }
}

async function api(
  path: string,
  jar: Jar,
  init: { method?: string; body?: unknown } = {},
): Promise<{ status: number; headers: Headers; json: unknown }> {
  const res = await fetch(`${ORIGIN}${path}`, {
    method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
    redirect: "manual",
    headers: {
      origin: ORIGIN,
      referer: `${ORIGIN}/sign-in`,
      cookie: jar.header,
      ...(init.body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  jar.save(res);
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, headers: res.headers, json };
}

function waitForServer(proc: ChildProcess): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("server did not boot in time")), 120000);
    let out = "";
    const onData = (chunk: Buffer): void => {
      out += chunk.toString();
      if (/ready on/i.test(out)) {
        clearTimeout(timer);
        resolve();
      }
    };
    proc.stdout?.on("data", onData);
    proc.stderr?.on("data", onData);
    proc.on("exit", () => reject(new Error(`server exited during boot: ${out.slice(-500)}`)));
  });
}

function startServer(): ChildProcess {
  // Resolve the real tsx entry: the .bin shim is a shell script and node
  // cannot execute it as a child entry on Windows.
  const tsxRoot = dirname(
    createRequire(import.meta.url).resolve("tsx/package.json"),
  );
  // Production mode: the dev lock belongs to the running dev server, and
  // a fresh process means fresh LRU budgets.
  return spawn(process.execPath, [joinPath(tsxRoot, "dist", "cli.mjs"), "server.ts"], {
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: "production",
      BETTER_AUTH_URL: ORIGIN,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function stopServer(server: ChildProcess): Promise<void> {
  server.kill();
  if (server.exitCode === null) {
    await once(server, "exit").catch(() => undefined);
  }
}

function connectSocket(cookie: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(ORIGIN, {
      transports: ["polling", "websocket"],
      reconnection: false,
      extraHeaders: cookie ? { cookie } : {},
    });
    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error("socket connect timed out"));
    }, 15000);
    socket.on("connect", () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.on("connect_error", (err: Error) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function join(socket: Socket, event: string): Promise<JoinResult> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, code: "TIMEOUT", retryAfterSec: 0 }), 10000);
    socket.emit(event, (result: JoinResult) => {
      clearTimeout(timer);
      resolve(result);
    });
  });
}

const stayIdOf = (room: string): string => room.replace("stay:stay:", "");

async function main(): Promise<void> {
  const tag = randomUUID().slice(0, 8);
  const roomNumber = `PR-${tag}`;
  const kitchenEmail = `prove-kitchen-${tag}@example.com`;
  const deskEmail = `prove-desk-${tag}@example.com`;
  const stayId = randomUUID();
  const kitchenId = randomUUID();
  const deskId = randomUUID();

  await prisma.stay.create({
    data: {
      id: stayId,
      roomNumber,
      guestName: "Prove Guest",
      checkIn: new Date(),
      checkOut: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: "ACTIVE",
      pinHash: await hashPin(PROVE_PIN),
    },
  });
  for (const [id, email, password, role] of [
    [kitchenId, kitchenEmail, KITCHEN_PASSWORD, "KITCHEN"],
    [deskId, deskEmail, DESK_PASSWORD, "FRONT_DESK"],
  ] as const) {
    await prisma.user.create({
      data: {
        id,
        name: "Prove Staff",
        email,
        emailVerified: false,
        role,
        mustChangePassword: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    await prisma.account.create({
      data: {
        id: randomUUID(),
        // Same shape as the creation seam: accountId carries the user id.
        accountId: id,
        providerId: "credential",
        userId: id,
        // Prove only cost: verifiable the same way, faster than prod cost.
        password: await bcryptHash(password, 4),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  const server = startServer();
  try {
    console.log("prove: server booting");
    await waitForServer(server);
    console.log("prove: server ready");

    // Denied joins with no cookie (AC-3).
    const bare = await connectSocket("");
    check("stay join with no cookie denied", (await join(bare, "join.stay")).ok === false);
    check("kitchen join with no cookie denied", (await join(bare, "join.kitchen")).ok === false);

    // Client emitted order state is ignored, never rebroadcast (AC-4).
    const heard: unknown[] = [];
    bare.on("order.created", (payload: unknown) => heard.push(payload));
    bare.emit("order.created", { stayId: "x", orderId: "y", status: "PENDING" });
    await new Promise((resolve) => setTimeout(resolve, 600));
    check("client emitted order state never rebroadcast", heard.length === 0);
    bare.disconnect();

    // Deny carries no secret echo (AC-8).
    const probe = await connectSocket("");
    const probeToken = `SECRET-PROBE-${tag}`;
    const denied = await new Promise<JoinResult>((resolve) => {
      probe.emit("join.stay", resolve);
    });
    void denied;
    const evil = await connectSocket(`${"stay_session"}=${probeToken}`);
    const evilDenied = await join(evil, "join.stay");
    check(
      "deny echoes no token",
      evilDenied.ok === false && !JSON.stringify(evilDenied).includes(probeToken),
    );
    evil.disconnect();
    probe.disconnect();

    // Join probe budget on one connection: 5 probes pass through to the
    // no session answer, the 6th trips the shared budget (AC-6).
    const hammer = await connectSocket("");
    let limited = false;
    for (let i = 0; i < 6; i += 1) {
      const result = await join(hammer, "join.stay");
      if (!result.ok && result.code === "RATE_LIMITED" && result.retryAfterSec > 0) limited = true;
    }
    check("join probe budget trips with retry timing", limited);
    hammer.disconnect();

    // REST 429 shape with retry timing on the mint route (AC-6).
    const jar = new Jar();
    const unknownStay = randomUUID();
    let mintLimited = false;
    let lastMint: { status: number; headers: Headers; json: unknown } | null = null;
    for (let i = 0; i < 6; i += 1) {
      lastMint = await api("/api/stay-session/mint", jar, {
        body: { stayId: unknownStay, pin: "000000" },
      });
    }
    if (lastMint && lastMint.status === 429) {
      const body = lastMint.json as { error?: { code?: string; retryAfter?: number } };
      mintLimited =
        body?.error?.code === "RATE_LIMITED" &&
        typeof body?.error?.retryAfter === "number" &&
        body.error.retryAfter > 0 &&
        (lastMint.headers.get("Retry-After") ?? "") !== "";
    }
    check("mint 429 carries code plus retry seconds plus header", mintLimited);

    // Positive stay join on a real minted session (AC-1 foundation).
    const guestJar = new Jar();
    const mint = await api("/api/stay-session/mint", guestJar, {
      body: { stayId, pin: PROVE_PIN },
    });
    check("fixture stay mints", mint.status === 200, `status=${mint.status}`);
    const guestSocket = await connectSocket(guestJar.header);
    const stayJoin = await join(guestSocket, "join.stay");
    check(
      "stay join lands in its own room",
      stayJoin.ok === true && stayIdOf(stayJoin.ok ? stayJoin.room : "") === stayId,
      JSON.stringify(stayJoin),
    );
    guestSocket.disconnect();

    // Positive kitchen join plus desk denial on real sessions (AC-3).
    const kitchenJar = new Jar();
    const kitchenSignIn = await api("/api/auth/sign-in/email", kitchenJar, {
      body: { email: kitchenEmail, password: KITCHEN_PASSWORD },
    });
    check("fixture kitchen signs in", kitchenSignIn.status === 200, `status=${kitchenSignIn.status}`);
    const kitchenSocket = await connectSocket(kitchenJar.header);
    const kitchenJoin = await join(kitchenSocket, "join.kitchen");
    check(
      "kitchen join lands on the board room",
      kitchenJoin.ok === true && (kitchenJoin.ok ? kitchenJoin.room : "") === "kitchen:board",
      JSON.stringify(kitchenJoin),
    );
    kitchenSocket.disconnect();

    const deskJar = new Jar();
    await api("/api/auth/sign-in/email", deskJar, {
      body: { email: deskEmail, password: DESK_PASSWORD },
    });
    const deskSocket = await connectSocket(deskJar.header);
    const deskJoin = await join(deskSocket, "join.kitchen");
    check(
      "desk cannot join the kitchen room",
      deskJoin.ok === false && deskJoin.code === "FORBIDDEN",
      JSON.stringify(deskJoin),
    );
    deskSocket.disconnect();
  } finally {
    await stopServer(server);
    await prisma.staySession.deleteMany({ where: { stayId } });
    await prisma.stay.deleteMany({ where: { id: stayId } });
    await prisma.user.deleteMany({ where: { id: { in: [kitchenId, deskId] } } });
    await prisma.$disconnect();
  }

  console.log(failures === 0 ? "prove-realtime: all green" : `prove-realtime: ${failures} failure(s)`);
  process.exitCode = failures === 0 ? 0 : 1;
}

void main().catch((err: unknown) => {
  console.log(`FAIL: prove crashed (${String(err).slice(0, 300)})`);
  process.exitCode = 1;
});
