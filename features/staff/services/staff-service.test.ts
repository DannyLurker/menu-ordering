// Service tests for staff accounts (spec 0006). Pure helpers are unit
// tested; account flows run against the local database with throwaway
// rows, following the data model test precedent, and clean up after
// themselves. Needs local Postgres with migrations applied.
import { afterAll, describe, expect, it } from "vitest";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/db";
import {
  StaffError,
  checkSignInAllowed,
  createStaffAccount,
  generateTempPassword,
  isValidEmail,
  listStaffAccounts,
  recordSignInFailure,
  reissueTempPassword,
  toStaffPublic,
  updateStaffAccount,
} from "./staff-service";

const RUN = Date.now().toString(36);
const email = (tag: string): string => `t17-${RUN}-${tag}@example.com`;

afterAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: `t17-${RUN}-` } },
  });
  for (const u of users) {
    await prisma.account.deleteMany({ where: { userId: u.id } });
    await prisma.session.deleteMany({ where: { userId: u.id } });
  }
  await prisma.user.deleteMany({
    where: { email: { startsWith: `t17-${RUN}-` } },
  });
  await prisma.$disconnect();
});

describe("generateTempPassword", () => {
  it("makes a 16 char alphanumeric secret that never repeats", () => {
    const first = generateTempPassword();
    const second = generateTempPassword();

    expect(first).toMatch(/^[A-Za-z0-9]{16}$/);
    expect(second).not.toBe(first);
  });
});

describe("isValidEmail", () => {
  it("accepts a real address and rejects junk", () => {
    expect(isValidEmail("chef@example.com")).toBe(true);
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
});

describe("toStaffPublic", () => {
  it("exposes only the safe profile fields", () => {
    expect(
      toStaffPublic({
        id: "u1",
        name: "Chef",
        email: "chef@example.com",
        role: "KITCHEN",
        mustChangePassword: true,
        isDisabled: false,
      }),
    ).toEqual({
      id: "u1",
      name: "Chef",
      email: "chef@example.com",
      role: "KITCHEN",
      mustChangePassword: true,
      isDisabled: false,
    });
  });
});

describe("createStaffAccount", () => {
  it("creates through the seam with a bcrypt row the temp verifies against, covers AC-1", async () => {
    const { id, tempPassword } = await createStaffAccount({
      name: "Seam Chef",
      email: email("create"),
      role: "KITCHEN",
    });
    const ctx = await auth.$context;
    const row = await prisma.user.findUnique({
      where: { id },
      include: { accounts: true },
    });
    const cred = row?.accounts.find((a) => a.providerId === "credential");

    expect(row?.role).toBe("KITCHEN");
    expect(row?.mustChangePassword).toBe(true);
    expect(cred?.password!.startsWith("$2b$10$")).toBe(true);
    expect(
      await ctx.password.verify({
        hash: cred?.password ?? "",
        password: tempPassword,
      }),
    ).toBe(true);
  });

  it("rejects a taken email with 409, covers AC-1", async () => {
    const dup = email("dup");
    await createStaffAccount({ name: "First", email: dup, role: "KITCHEN" });

    await expect(
      createStaffAccount({ name: "Second", email: dup, role: "KITCHEN" }),
    ).rejects.toMatchObject({
      status: 409,
      code: "EMAIL_TAKEN",
    });
  });
});

describe("reissueTempPassword", () => {
  it("rotates through the seam so the old temp dies and the new one verifies, covers AC-2", async () => {
    const created = await createStaffAccount({
      name: "Rotate Chef",
      email: email("rotate"),
      role: "KITCHEN",
    });
    const ctx = await auth.$context;

    const next = await reissueTempPassword(created.id);
    const row = await prisma.user.findUnique({
      where: { id: created.id },
      include: { accounts: true },
    });
    const cred = row?.accounts.find((a) => a.providerId === "credential");

    expect(next).not.toBe(created.tempPassword);
    expect(
      await ctx.password.verify({
        hash: cred?.password ?? "",
        password: created.tempPassword,
      }),
    ).toBe(false);
    expect(
      await ctx.password.verify({ hash: cred?.password ?? "", password: next }),
    ).toBe(true);
    expect(row?.mustChangePassword).toBe(true);
  });

  it("answers 404 for an unknown account, covers AC-2", async () => {
    await expect(
      reissueTempPassword("00000000-0000-0000-0000-000000000000"),
    ).rejects.toMatchObject({
      status: 404,
      code: "UNKNOWN_USER",
    });
  });
});

describe("sign in lockout", () => {
  it("locks after five misses, cools down, and unlocks by admin, covers AC-4", async () => {
    const lockEmail = email("lock");
    const created = await createStaffAccount({
      name: "Lock Chef",
      email: lockEmail,
      role: "FRONT_DESK",
    });

    for (let i = 0; i < 5; i += 1) {
      await recordSignInFailure(lockEmail);
    }
    const locked = await prisma.user.findUnique({ where: { id: created.id } });
    expect(locked?.failedSignInAttempts).toBe(5);
    expect(locked?.lockedUntil instanceof Date).toBe(true);
    await expect(checkSignInAllowed(lockEmail)).rejects.toMatchObject({
      status: 423,
    });

    await updateStaffAccount({
      adminId: created.id,
      targetId: created.id,
      unlock: true,
    });
    await expect(checkSignInAllowed(lockEmail)).resolves.toBeNull();
  });
});

describe("updateStaffAccount", () => {
  it("refuses self demote and self disable with 403, covers AC-4", async () => {
    const created = await createStaffAccount({
      name: "Admin Self",
      email: email("self"),
      role: "ADMIN",
    });

    await expect(
      updateStaffAccount({
        adminId: created.id,
        targetId: created.id,
        role: "KITCHEN",
      }),
    ).rejects.toMatchObject({
      status: 403,
      code: "SELF_GUARD",
    });
    await expect(
      updateStaffAccount({
        adminId: created.id,
        targetId: created.id,
        isDisabled: true,
      }),
    ).rejects.toMatchObject({ status: 403, code: "SELF_GUARD" });
  });

  it("rejects an unknown role and an unknown account, covers AC-4", async () => {
    const created = await createStaffAccount({
      name: "Role Chef",
      email: email("role"),
      role: "KITCHEN",
    });

    await expect(
      updateStaffAccount({ adminId: "x", targetId: created.id, role: "OWNER" }),
    ).rejects.toMatchObject({
      status: 422,
    });
    await expect(
      updateStaffAccount({
        adminId: "x",
        targetId: "00000000-0000-0000-0000-000000000000",
        role: "KITCHEN",
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("carries StaffError status and code for route mapping", () => {
    const err = new StaffError(
      409,
      "EMAIL_TAKEN",
      "That email is already registered.",
    );

    expect(err.status).toBe(409);
    expect(err.code).toBe("EMAIL_TAKEN");
  });
});

describe("listStaffAccounts", () => {
  it("pages the roster with totals", async () => {
    const { items, total } = await listStaffAccounts({ take: 1, skip: 0 });

    expect(items).toHaveLength(1);
    expect(total).toBeGreaterThanOrEqual(1);
    expect(items[0]).toHaveProperty("role");
  });
});
