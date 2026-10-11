// Unit tests for the server emit helper (spec 0007 AC-1, AC-2, AC-4,
// AC-8). A fake socket server stands in for the live one; what is
// asserted is our own fanout: the rooms, the event names, the exact
// payload shape, and fail closed validation. No network, no database.
import { beforeEach, describe, expect, it } from "vitest";
import {
  emitOrderCreated,
  emitOrderStatusChanged,
  setRealtimeServer,
} from "./realtime-server";

interface Fanout {
  rooms: string[];
  event: string;
  payload: unknown;
}

function fakeIo(): { server: unknown; fanouts: Fanout[] } {
  const fanouts: Fanout[] = [];
  const rooms: string[] = [];
  const chain = {
    to(room: string) {
      rooms.push(room);
      return chain;
    },
    emit(event: string, payload: unknown) {
      fanouts.push({ rooms: [...rooms], event, payload });
      rooms.length = 0;
    },
  };
  return { server: { to: (room: string) => chain.to(room) }, fanouts };
}

beforeEach(() => {
  setRealtimeServer(null);
});

describe("emitOrderCreated", () => {
  it("fans order created to the stay room plus the kitchen room, covers AC-1", () => {
    const { server, fanouts } = fakeIo();
    setRealtimeServer(server as never);

    expect(emitOrderCreated({ stayId: "s-1", orderId: "o-1" })).toBe(true);

    expect(fanouts).toHaveLength(1);
    expect(fanouts[0].event).toBe("order.created");
    expect(fanouts[0].rooms).toEqual(["stay:stay:s-1", "kitchen:board"]);
    expect(fanouts[0].payload).toEqual({
      stayId: "s-1",
      orderId: "o-1",
      status: "PENDING",
      etaMinutes: null,
    });
  });

  it("validates then reports false with no server booted, covers AC-1", () => {
    expect(emitOrderCreated({ stayId: "s-1", orderId: "o-1" })).toBe(false);
  });
});

describe("emitOrderStatusChanged", () => {
  it("fans status plus ETA to the same two rooms, covers AC-2", () => {
    const { server, fanouts } = fakeIo();
    setRealtimeServer(server as never);

    expect(
      emitOrderStatusChanged({ stayId: "s-1", orderId: "o-1", status: "PREPARING", etaMinutes: 15 }),
    ).toBe(true);

    expect(fanouts).toHaveLength(1);
    expect(fanouts[0].event).toBe("order.status.changed");
    expect(fanouts[0].rooms).toEqual(["stay:stay:s-1", "kitchen:board"]);
    expect(fanouts[0].payload).toEqual({
      stayId: "s-1",
      orderId: "o-1",
      status: "PREPARING",
      etaMinutes: 15,
    });
  });

  it("refuses unknown statuses and bad ETAs instead of emitting, covers AC-4", () => {
    const { server, fanouts } = fakeIo();
    setRealtimeServer(server as never);

    expect(() =>
      emitOrderStatusChanged({ stayId: "s-1", orderId: "o-1", status: "FIRED", etaMinutes: null }),
    ).toThrow();
    expect(() =>
      emitOrderStatusChanged({ stayId: "s-1", orderId: "o-1", status: "READY", etaMinutes: 1.5 }),
    ).toThrow();
    expect(fanouts).toHaveLength(0);
  });

  it("emits ids plus status plus ETA and nothing else, covers AC-8", () => {
    const { server, fanouts } = fakeIo();
    setRealtimeServer(server as never);

    emitOrderStatusChanged({ stayId: "s-1", orderId: "o-1", status: "READY", etaMinutes: null });

    expect(Object.keys(fanouts[0].payload as object).sort()).toEqual([
      "etaMinutes",
      "orderId",
      "status",
      "stayId",
    ]);
  });
});
