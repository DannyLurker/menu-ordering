// Unit tests for the shared realtime contract (spec 0007). Room naming,
// payload shape, status guard, and UI copy. No sockets and no database:
// the contract is pure so screens plus server plus routes share it.
import { describe, expect, it } from "vitest";
import {
  JOIN_DENIED,
  JOIN_KITCHEN,
  JOIN_STAY,
  KITCHEN_ROOM,
  LOCK_MESSAGE,
  ORDER_CREATED,
  ORDER_STATUS_CHANGED,
  ORDER_STATUSES,
  THROTTLE_MESSAGE,
  buildOrderCreated,
  buildOrderStatusChanged,
  isOrderStatus,
  joinDenied,
  stayRoom,
} from "./realtime";

describe("rooms and events", () => {
  it("derives stay rooms from the stay id and fixes the kitchen room, covers AC-3", () => {
    expect(stayRoom("stay-1")).toBe("stay:stay:stay-1");
    expect(stayRoom("stay-1")).not.toBe(stayRoom("stay-2"));
    expect(KITCHEN_ROOM).toBe("kitchen:board");
  });

  it("keeps the event catalog stable for every slice", () => {
    expect([JOIN_STAY, JOIN_KITCHEN, JOIN_DENIED]).toEqual([
      "join.stay",
      "join.kitchen",
      "join.denied",
    ]);
    expect([ORDER_CREATED, ORDER_STATUS_CHANGED]).toEqual([
      "order.created",
      "order.status.changed",
    ]);
  });
});

describe("payload shape", () => {
  it("builds created payloads as PENDING with null ETA, covers AC-1", () => {
    expect(buildOrderCreated({ stayId: "s", orderId: "o" })).toEqual({
      stayId: "s",
      orderId: "o",
      status: "PENDING",
      etaMinutes: null,
    });
  });

  it("builds changed payloads with status plus ETA and nothing else, covers AC-2, AC-8", () => {
    const payload = buildOrderStatusChanged({
      stayId: "s",
      orderId: "o",
      status: "PREPARING",
      etaMinutes: 15,
    });
    expect(payload).toEqual({ stayId: "s", orderId: "o", status: "PREPARING", etaMinutes: 15 });
    expect(Object.keys(payload).sort()).toEqual(["etaMinutes", "orderId", "status", "stayId"]);
  });

  it("rejects unknown statuses and bad ETAs instead of emitting, covers AC-4", () => {
    expect(() =>
      buildOrderStatusChanged({ stayId: "s", orderId: "o", status: "FIRED", etaMinutes: null }),
    ).toThrow();
    expect(() =>
      buildOrderStatusChanged({ stayId: "s", orderId: "o", status: "READY", etaMinutes: -1 }),
    ).toThrow();
    expect(() =>
      buildOrderStatusChanged({ stayId: "", orderId: "o", status: "READY", etaMinutes: null }),
    ).toThrow();
  });

  it("guards the full status set from the data model", () => {
    expect(ORDER_STATUSES).toContain("PENDING");
    expect(isOrderStatus("SERVED")).toBe(true);
    expect(isOrderStatus("FIRED")).toBe(false);
    expect(isOrderStatus(null)).toBe(false);
  });
});

describe("join answers and copy", () => {
  it("denies with code plus retry seconds, covers AC-6, AC-7", () => {
    expect(joinDenied("RATE_LIMITED", 30)).toEqual({ ok: false, code: "RATE_LIMITED", retryAfterSec: 30 });
    expect(joinDenied("NO_SESSION", 0).ok).toBe(false);
  });

  it("keeps throttle copy distinct from lock copy", () => {
    expect(THROTTLE_MESSAGE).not.toBe(LOCK_MESSAGE);
    expect(LOCK_MESSAGE).toMatch(/staff/i);
  });
});
