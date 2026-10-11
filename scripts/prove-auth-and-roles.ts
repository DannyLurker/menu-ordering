// Prove walk for spec 0004 auth and roles (build plan task 8).
// Boots scratch production servers (fresh LRU budgets every boot), then
// walks: admin seed plus create, sign in per role plus gates, temp change,
// lockout plus a mid run restart proving the lock is durable in Postgres,
// self guard, mint plus 409 plus revoke, checkout block, limiter 429s.
// Usage: `next build` first when app code changed, then:
// pnpm tsx scripts/prove-auth-and-roles.ts
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/db";
import { hashPin } from "../lib/pin";
import { hashPassword } from "better-auth/crypto";

const PORT = 3111;
const ORIGIN = `http://localhost:${PORT}`;
const DEMO_STAY = "seed-stay-demo";
const DEMO_PIN = "123456";
const KITCHEN_EMAIL = "prove-kitchen@example.com";
const DESK_EMAIL = "prove-desk@example.com";
const LOCK_EMAIL = "prove-locked@example.com";
const ADMIN_NEW_PASSWORD = "Prove-Admin-98765";
const STAFF_NEW_PASSWORD = "Prove-Staff-12345";

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
    const getSetCookie = (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
    const setCookies: string[] = typeof getSetCookie === "function" ? getSetCookie.call(res.headers) : [];
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
): Promise<{ status: number; location: string | null; json: unknown }> {
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
  return { status: res.status, location: res.headers.get("location"), json };
}

function waitForServer(proc: ChildProcess): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("server did not boot in time")), 90000);
    let out = "";
    const onData = (chunk: Buffer): void => {
      out += chunk.toString();
      if (/ready|started server/i.test(out)) {
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
  // Production server on a scratch port: the dev lock belongs to the running
  // dev server, and a fresh process means fresh LRU budgets.
  return spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], {
    env: { ...process.env, BETTER_AUTH_URL: ORIGIN },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function restartServer(proc: ChildProcess): Promise<ChildProcess> {
  proc.kill();
  await once(proc, "exit").catch(() => undefined);
  const next = startServer();
  await waitForServer(next);
  return next;
}

async function setup(): Promise<{ adminEmail: string; adminPassword: string }> {
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "";
  if (!adminEmail || !adminPassword) throw new Error("SEED_ADMIN_EMAIL/PASSWORD required in .env");
  // Idempotent scratch state: fresh PIN, unlocked demo stay, no prove users.
  await prisma.staySession.deleteMany({ where: { stayId: DEMO_STAY } });
  await prisma.stay.update({
    where: { id: DEMO_STAY },
    data: { status: "ACTIVE", pinHash: hashPin(DEMO_PIN), failedPinAttempts: 0, pinLocked: false },
  });
  await prisma.user.deleteMany({ where: { email: { in: [KITCHEN_EMAIL, DESK_EMAIL, LOCK_EMAIL] } } });
  const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (admin) {
    // Deterministic scratch state: the walk rotates this secret in step 1,
    // so every run starts from the env value again (dev only).
    await prisma.$transaction([
      prisma.account.updateMany({
        where: { userId: admin.id, providerId: "credential" },
        data: { password: await hashPassword(adminPassword), updatedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: admin.id },
        data: { mustChangePassword: true, isDisabled: false, failedSignInAttempts: 0, lockedUntil: null, role: "ADMIN" },
      }),
    ]);
  }
  return { adminEmail, adminPassword };
}

async function main(): Promise<void> {
  const { adminEmail, adminPassword } = await setup();
  let proc = startServer();
  try {
    await waitForServer(proc);
    console.log("ok: scratch server booted");

    const admin = new Jar();
    const kitchen = new Jar();
    const desk = new Jar();
    const locked = new Jar();

    // 1. Admin signs in with the seeded secret, then rotates it (AC-1, AC-8).
    let r = await api("/api/auth/sign-in/email", admin, { body: { email: adminEmail, password: adminPassword } });
    check("admin signs in with seed secret", r.status === 200, `status ${r.status}`);
    r = await api("/api/staff/me", admin);
    check(
      "seeded admin carries must change",
      r.status === 200 && (r.json as { mustChangePassword?: boolean })?.mustChangePassword === true,
      `status ${r.status}`,
    );
    r = await api("/api/staff/me/password", admin, { body: { current: adminPassword, next: ADMIN_NEW_PASSWORD } });
    check("admin sets a real password", r.status === 200, `status ${r.status}`);

    // 2. Admin creates kitchen, desk, and lock probe staff (AC-2, AC-8).
    r = await api("/api/staff", admin, { body: { name: "Prove Kitchen", email: KITCHEN_EMAIL, role: "KITCHEN" } });
    const kitchenTemp = (r.json as { tempPassword?: string })?.tempPassword ?? "";
    check("admin creates kitchen staff with temp secret", r.status === 201 && kitchenTemp.length === 16, `status ${r.status}`);
    r = await api("/api/staff", admin, { body: { name: "Prove Desk", email: DESK_EMAIL, role: "FRONT_DESK" } });
    const deskTemp = (r.json as { tempPassword?: string })?.tempPassword ?? "";
    check("admin creates desk staff with temp secret", r.status === 201 && deskTemp.length === 16, `status ${r.status}`);
    r = await api("/api/staff", admin, { body: { name: "Prove Locked", email: LOCK_EMAIL, role: "FRONT_DESK" } });
    const lockTemp = (r.json as { tempPassword?: string })?.tempPassword ?? "";
    check("admin creates lock probe staff", r.status === 201 && lockTemp.length === 16, `status ${r.status}`);
    const lockId = (r.json as { id?: string })?.id ?? "";
    r = await api("/api/staff", admin, { body: { name: "Dupe", email: DESK_EMAIL, role: "KITCHEN" } });
    check("duplicate email gets 409", r.status === 409, `status ${r.status}`);

    // 3. Kitchen signs in with temp, is forced to rotate, reaches the board,
    // but cannot reach staff admin (AC-1, AC-2, AC-8).
    r = await api("/api/auth/sign-in/email", kitchen, { body: { email: KITCHEN_EMAIL, password: kitchenTemp } });
    check("kitchen signs in with temp secret", r.status === 200, `status ${r.status}`);
    r = await api("/kitchen", kitchen);
    check("kitchen without new password is sent to change it", r.status === 307 && r.location === "/change-password", `status ${r.status} loc ${r.location}`);
    r = await api("/api/staff/me/password", kitchen, { body: { current: kitchenTemp, next: STAFF_NEW_PASSWORD } });
    check("kitchen sets a real password", r.status === 200, `status ${r.status}`);
    r = await api("/kitchen", kitchen);
    check("kitchen reaches the board", r.status === 200, `status ${r.status}`);
    r = await api("/staff", kitchen);
    check("kitchen is bounced off staff admin", r.status === 307 && r.location === "/kitchen", `status ${r.status} loc ${r.location}`);
    r = await api("/api/staff", kitchen);
    check("kitchen cannot list staff (403)", r.status === 403, `status ${r.status}`);

    // 4. Desk signs in, rotates the temp secret, and unlocks stays;
    // kitchen cannot unlock (AC-2, AC-7, AC-8).
    r = await api("/api/auth/sign-in/email", desk, { body: { email: DESK_EMAIL, password: deskTemp } });
    check("desk signs in", r.status === 200, `status ${r.status}`);
    r = await api("/api/staff/me/password", desk, { body: { current: deskTemp, next: STAFF_NEW_PASSWORD } });
    check("desk sets a real password", r.status === 200, `status ${r.status}`);
    r = await api(`/api/stays/${DEMO_STAY}/unlock`, desk, { method: "POST" });
    check("desk unlocks a stay", r.status === 200, `status ${r.status}`);
    r = await api(`/api/stays/${DEMO_STAY}/unlock`, kitchen, { method: "POST" });
    check("kitchen cannot unlock (403)", r.status === 403, `status ${r.status}`);

    // 5. Wrong staff passwords stay generic, then lock durably: the restart
    // wipes LRU, so the 423 after boot proves the Postgres columns (AC-5).
    let generic = true;
    for (let i = 0; i < 5; i += 1) {
      const w = await api("/api/auth/sign-in/email", locked, { body: { email: LOCK_EMAIL, password: "wrong-password-1" } });
      if (w.status !== 401) generic = false;
      if (JSON.stringify(w.json).includes(LOCK_EMAIL)) generic = false;
    }
    check("five wrong passwords fail generic 401", generic, "");
    proc = await restartServer(proc);
    console.log("ok: scratch server rebooted (LRU wiped)");
    r = await api("/api/auth/sign-in/email", locked, { body: { email: LOCK_EMAIL, password: lockTemp } });
    check("correct password still cools down after reboot (423)", r.status === 423, `status ${r.status}`);
    r = await api(`/api/staff/${lockId}`, admin, { method: "PATCH", body: { unlock: true } });
    check("admin clears the staff lock", r.status === 200, `status ${r.status}`);
    r = await api("/api/auth/sign-in/email", locked, { body: { email: LOCK_EMAIL, password: lockTemp } });
    check("staffer signs in after unlock", r.status === 200, `status ${r.status}`);

    // 6. Admin cannot demote or disable themselves (AC-8).
    const meAdmin = await api("/api/staff/me", admin);
    const adminId = (meAdmin.json as { id?: string })?.id ?? "";
    r = await api(`/api/staff/${adminId}`, admin, { method: "PATCH", body: { isDisabled: true } });
    check("admin cannot disable self (403)", r.status === 403, `status ${r.status}`);
    r = await api(`/api/staff/${adminId}`, admin, { method: "PATCH", body: { role: "KITCHEN" } });
    check("admin cannot demote self (403)", r.status === 403, `status ${r.status}`);

    // 7. Guest PIN: wrong asks again, five lock, unlock restores access,
    // mint is single live per stay (AC-3, AC-7).
    const guest = new Jar();
    let pinGeneric = true;
    for (let i = 0; i < 5; i += 1) {
      const w = await api("/api/stay-session/mint", guest, { body: { stayId: DEMO_STAY, pin: "000000" } });
      if (w.status !== 401) pinGeneric = false;
    }
    check("five wrong PINs ask again (401)", pinGeneric, "");
    r = await api("/api/stay-session/mint", guest, { body: { stayId: DEMO_STAY, pin: "000000" } });
    check("locked stay refuses mint (403)", r.status === 403, `status ${r.status}`);
    r = await api(`/api/stays/${DEMO_STAY}/unlock`, desk, { method: "POST" });
    check("desk unlocks the PIN locked stay", r.status === 200, `status ${r.status}`);
    r = await api("/api/stay-session/mint", guest, { body: { stayId: DEMO_STAY, pin: DEMO_PIN } });
    check("correct PIN mints one stay session", r.status === 200, `status ${r.status}`);
    r = await api("/api/stay-session/mint", new Jar(), { body: { stayId: DEMO_STAY, pin: DEMO_PIN } });
    check("second device gets 409 with reuse hint", r.status === 409, `status ${r.status}`);
    r = await api("/api/stay-session/revoke", guest, { method: "POST" });
    check("guest signs out (revoke)", r.status === 200, `status ${r.status}`);
    r = await api("/api/stay-session/mint", guest, { body: { stayId: DEMO_STAY, pin: DEMO_PIN } });
    check("mint works again after sign out", r.status === 200, `status ${r.status}`);

    // 8. Checked out stays cannot mint (AC-6).
    await prisma.stay.update({ where: { id: DEMO_STAY }, data: { status: "CHECKED_OUT" } });
    r = await api("/api/stay-session/mint", new Jar(), { body: { stayId: DEMO_STAY, pin: DEMO_PIN } });
    check("checked out stay cannot mint (403)", r.status === 403, `status ${r.status}`);
    await prisma.stay.update({ where: { id: DEMO_STAY }, data: { status: "ACTIVE" } });

    // 9. Mint limiter answers 429 past budget on a fresh key (AC-5).
    const spamId = `prove-${randomUUID()}`;
    const spam = new Jar();
    let limited = false;
    for (let i = 0; i < 7; i += 1) {
      const w = await api("/api/stay-session/mint", spam, { body: { stayId: spamId, pin: "000000" } });
      if (w.status === 429) limited = true;
    }
    check("mint answers 429 past budget", limited, "");

    // 10. Temp reissue rotates the secret (AC-8 recovery path).
    const kitchenRow = await prisma.user.findUnique({ where: { email: KITCHEN_EMAIL } });
    r = await api("/api/staff/reissue", admin, { body: { userId: kitchenRow?.id ?? "" } });
    const rotated = (r.json as { tempPassword?: string })?.tempPassword ?? "";
    check("admin reissues a temp secret once", r.status === 200 && rotated.length === 16, `status ${r.status}`);

    console.log(failures === 0 ? "PROVE PASS" : `PROVE FAIL (${failures})`);
  } finally {
    proc.kill();
    await prisma.$disconnect();
  }
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((err: unknown) => {
  console.error("prove crashed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
