import { describe, expect, it } from "vitest";
import {
  cancelOrderInputSchema,
  updateEtaInputSchema,
  verifyOrderInputSchema,
} from "./kitchen.schemas";

describe("verifyOrderInputSchema", () => {
  it("accepts valid ETA between 1 and 120", () => {
    expect(verifyOrderInputSchema.parse({ etaMinutes: 1 })).toEqual({ etaMinutes: 1 });
    expect(verifyOrderInputSchema.parse({ etaMinutes: 25 })).toEqual({ etaMinutes: 25 });
    expect(verifyOrderInputSchema.parse({ etaMinutes: 120 })).toEqual({ etaMinutes: 120 });
  });

  it("rejects non-integer, negative, zero, and over 120", () => {
    expect(() => verifyOrderInputSchema.parse({ etaMinutes: 0 })).toThrow();
    expect(() => verifyOrderInputSchema.parse({ etaMinutes: -5 })).toThrow();
    expect(() => verifyOrderInputSchema.parse({ etaMinutes: 15.5 })).toThrow();
    expect(() => verifyOrderInputSchema.parse({ etaMinutes: 121 })).toThrow();
    expect(() => verifyOrderInputSchema.parse({})).toThrow();
  });
});

describe("updateEtaInputSchema", () => {
  it("accepts valid ETA between 1 and 120", () => {
    expect(updateEtaInputSchema.parse({ etaMinutes: 10 })).toEqual({ etaMinutes: 10 });
  });

  it("rejects out of range values", () => {
    expect(() => updateEtaInputSchema.parse({ etaMinutes: 0 })).toThrow();
    expect(() => updateEtaInputSchema.parse({ etaMinutes: 200 })).toThrow();
  });
});

describe("cancelOrderInputSchema", () => {
  it("accepts valid non-empty reason up to 200 chars", () => {
    expect(cancelOrderInputSchema.parse({ reason: "Item out of stock" })).toEqual({
      reason: "Item out of stock",
    });
    const maxReason = "a".repeat(200);
    expect(cancelOrderInputSchema.parse({ reason: maxReason })).toEqual({
      reason: maxReason,
    });
  });

  it("trims and rejects empty or over 200 chars reason", () => {
    expect(() => cancelOrderInputSchema.parse({ reason: "   " })).toThrow();
    expect(() => cancelOrderInputSchema.parse({ reason: "" })).toThrow();
    expect(() => cancelOrderInputSchema.parse({ reason: "a".repeat(201) })).toThrow();
    expect(() => cancelOrderInputSchema.parse({})).toThrow();
  });
});
