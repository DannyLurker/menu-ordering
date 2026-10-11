// Schema tests for staff request bodies and queries (spec 0004 rule 6).
// Handlers trust parsed values, so the boundary contract is pinned here.
import { describe, expect, it } from "vitest";
import {
  createStaffBody,
  passwordBody,
  reissueBody,
  staffListQuery,
  updateStaffBody,
} from "./schemas";

describe("createStaffBody", () => {
  it("accepts a trimmed name, a valid email, and a known role", () => {
    const parsed = createStaffBody.safeParse({ name: "  Night Chef  ", email: "CHEF@Example.COM", role: "KITCHEN" });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe("Night Chef");
      expect(parsed.data.email).toBe("chef@example.com");
    }
  });

  it("rejects an empty name, a bad email, and an unknown role", () => {
    expect(createStaffBody.safeParse({ name: "", email: "chef@example.com", role: "KITCHEN" }).success).toBe(false);
    expect(createStaffBody.safeParse({ name: "Chef", email: "not-an-email", role: "KITCHEN" }).success).toBe(false);
    expect(createStaffBody.safeParse({ name: "Chef", email: "chef@example.com", role: "OWNER" }).success).toBe(false);
  });
});

describe("updateStaffBody", () => {
  it("accepts an empty patch and each known field", () => {
    expect(updateStaffBody.safeParse({}).success).toBe(true);
    expect(updateStaffBody.safeParse({ role: "ADMIN" }).success).toBe(true);
    expect(updateStaffBody.safeParse({ isDisabled: true }).success).toBe(true);
    expect(updateStaffBody.safeParse({ unlock: true }).success).toBe(true);
  });

  it("rejects an unknown role and a non boolean flag", () => {
    expect(updateStaffBody.safeParse({ role: "OWNER" }).success).toBe(false);
    expect(updateStaffBody.safeParse({ isDisabled: "yes" }).success).toBe(false);
  });
});

describe("reissueBody", () => {
  it("accepts a user id and rejects an empty one", () => {
    expect(reissueBody.safeParse({ userId: "abc-123" }).success).toBe(true);
    expect(reissueBody.safeParse({ userId: "" }).success).toBe(false);
    expect(reissueBody.safeParse({}).success).toBe(false);
  });
});

describe("passwordBody", () => {
  it("accepts a current secret plus a new secret of at least 10 chars", () => {
    expect(passwordBody.safeParse({ current: "old-secret", next: "New-Secret-12" }).success).toBe(true);
  });

  it("rejects an empty current secret and a short next secret", () => {
    expect(passwordBody.safeParse({ current: "", next: "New-Secret-12" }).success).toBe(false);
    expect(passwordBody.safeParse({ current: "old-secret", next: "short" }).success).toBe(false);
  });
});

describe("staffListQuery", () => {
  it("defaults paging when nothing is given", () => {
    const parsed = staffListQuery.safeParse({});

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toEqual({ take: 20, skip: 0 });
  });

  it("falls back to defaults on garbage or out of range values", () => {
    const garbage = staffListQuery.safeParse({ take: "many", skip: "few" });

    expect(garbage.success).toBe(true);
    if (garbage.success) expect(garbage.data).toEqual({ take: 20, skip: 0 });
    const clamped = staffListQuery.safeParse({ take: 999, skip: -1 });

    expect(clamped.success).toBe(true);
    if (clamped.success) expect(clamped.data).toEqual({ take: 20, skip: 0 });
  });
});
