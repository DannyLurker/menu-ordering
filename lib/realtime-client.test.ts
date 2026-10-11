// Regression tests for the realtime browser helper (spec 0007 AC-5,
// the first load never joined). The socket client is mocked at the
// boundary; what is asserted is our own wiring: join on every connect,
// refetch plus resync only after the first one.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("socket.io-client", () => ({ io: vi.fn() }));

import { io } from "socket.io-client";
import { createRealtimeClient } from "./realtime-client";

type Handler = (...args: never[]) => void;

interface FakeSocket {
  handlers: Map<string, Handler>;
  emit: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  connected: boolean;
  on: (event: string, cb: Handler) => void;
}

function fakeSocket(): FakeSocket {
  const sock: FakeSocket = {
    handlers: new Map(),
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    connected: false,
    on(event: string, cb: Handler): void {
      sock.handlers.set(event, cb);
    },
  };
  return sock;
}

function fire(sock: FakeSocket, event: string, ...args: never[]): void {
  sock.handlers.get(event)?.(...args);
}

beforeEach(() => {
  vi.mocked(io).mockReset();
});

describe("createRealtimeClient connect", () => {
  it("emits join on first connect with no refetch, covers AC-5", () => {
    const sock = fakeSocket();
    vi.mocked(io).mockReturnValue(sock as never);
    const refetch = vi.fn();
    const onResync = vi.fn();
    const client = createRealtimeClient({
      onOrderEvent: () => undefined,
      refetch,
      onResync,
    });

    client.connect({ stay: true });
    fire(sock, "connect");

    expect(sock.emit).toHaveBeenCalledTimes(1);
    expect(sock.emit.mock.calls[0][0]).toBe("join.stay");
    expect(typeof sock.emit.mock.calls[0][1]).toBe("function");
    expect(refetch).not.toHaveBeenCalled();
    expect(onResync).not.toHaveBeenCalled();
  });

  it("rejoins plus refetches plus resyncs on later connects, covers AC-5", () => {
    const sock = fakeSocket();
    vi.mocked(io).mockReturnValue(sock as never);
    const refetch = vi.fn();
    const onResync = vi.fn();
    const onJoinDenied = vi.fn();
    const client = createRealtimeClient({
      onOrderEvent: () => undefined,
      refetch,
      onResync,
      onJoinDenied,
    });

    client.connect({ kitchen: true });
    fire(sock, "connect");
    fire(sock, "connect");

    expect(sock.emit).toHaveBeenCalledTimes(2);
    expect(sock.emit.mock.calls[1][0]).toBe("join.kitchen");
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(onResync).toHaveBeenCalledTimes(1);

    // A denied rejoin still surfaces its code plus retry timing.
    const ack = sock.emit.mock.calls[1][1] as (result: unknown) => void;
    ack({ ok: false, code: "RATE_LIMITED", retryAfterSec: 30 });
    expect(onJoinDenied).toHaveBeenCalledWith({ code: "RATE_LIMITED", retryAfterSec: 30 });
  });
});
