// Browser side of the realtime foundation (spec 0007, AC-5). Joins the
// stay or kitchen room, rejoins plus refetches on reconnect and on
// focus, and hands order events to the owning screen as hints. Screens
// own their REST reads: this helper never fetches, it only calls the
// refetch callback the screen hands in. UI agnostic on purpose, so guest
// plus kitchen slices share it with no per slice socket code.
import { io, type Socket } from "socket.io-client";
import {
  JOIN_DENIED,
  JOIN_KITCHEN,
  JOIN_STAY,
  ORDER_CREATED,
  ORDER_STATUS_CHANGED,
  type JoinResult,
  type OrderEventPayload,
} from "./realtime";

export type RoomKind = { stay: true } | { kitchen: true };

export type OrderHint = typeof ORDER_CREATED | typeof ORDER_STATUS_CHANGED;

export interface RealtimeCallbacks {
  /** A live hint arrived. The screen decides when to refetch REST truth. */
  onOrderEvent: (event: OrderHint, payload: OrderEventPayload) => void;
  /** REST truth read owned by the screen (order or board fetch). */
  refetch: () => void | Promise<void>;
  /** Rejoin plus refetch just healed a gap. Show a subtle updated note. */
  onResync?: () => void;
  /** Join denied with a stable code plus retry seconds. */
  onJoinDenied?: (info: { code: string; retryAfterSec: number }) => void;
}

export interface RealtimeHandle {
  connect: (kind: RoomKind) => void;
  disconnect: () => void;
  connected: () => boolean;
}

/** Focus refetches at most once per window (spec: 5s debounce). */
const FOCUS_DEBOUNCE_MS = 5000;

function joinEvent(kind: RoomKind): string {
  return "stay" in kind ? JOIN_STAY : JOIN_KITCHEN;
}

export function createRealtimeClient(
  callbacks: RealtimeCallbacks,
): RealtimeHandle {
  let socket: Socket | null = null;
  let kind: RoomKind | null = null;
  let lastRefetch = 0;

  function refetch(reason: string): void {
    const now = Date.now();
    if (now - lastRefetch < FOCUS_DEBOUNCE_MS) return;
    lastRefetch = now;
    try {
      void callbacks.refetch();
    } catch {
      // A failing read must never kill the socket; the screen owns errors.
    }
    if (reason === "reconnect" || reason === "focus") callbacks.onResync?.();
  }

  function join(): void {
    if (!socket || !kind) return;
    const event = joinEvent(kind);
    socket.emit(event, (result: JoinResult) => {
      if (!result.ok) {
        callbacks.onJoinDenied?.({ code: result.code, retryAfterSec: result.retryAfterSec });
      }
    });
  }

  function onFocus(): void {
    if (!socket?.connected || !kind) return;
    join();
    refetch("focus");
  }

  function onOnline(): void {
    onFocus();
  }

  return {
    connect(next: RoomKind): void {
      kind = next;
      if (!socket) {
        socket = io({
          transports: ["polling", "websocket"],
          reconnection: true,
        });
        socket.on(ORDER_CREATED, (payload: OrderEventPayload) =>
          callbacks.onOrderEvent(ORDER_CREATED, payload),
        );
        socket.on(ORDER_STATUS_CHANGED, (payload: OrderEventPayload) =>
          callbacks.onOrderEvent(ORDER_STATUS_CHANGED, payload),
        );
        socket.on(JOIN_DENIED, (info: { code: string; retryAfterSec: number }) =>
          callbacks.onJoinDenied?.(info),
        );
        // `connect` fires on every (re)connection, `reconnect` only after
        // a drop, so joining here covers first load plus every heal with
        // one call site. The screen loads REST truth itself on first
        // load; refetch plus resync run only on later connects.
        let firstConnect = true;
        socket.on("connect", () => {
          join();
          if (!firstConnect) refetch("reconnect");
          firstConnect = false;
        });
        if (typeof window !== "undefined") {
          window.addEventListener("focus", onFocus);
          window.addEventListener("online", onOnline);
        }
        if (typeof document !== "undefined") {
          document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") onFocus();
          });
        }
      }
      if (!socket.connected) socket.connect();
      else join();
    },
    disconnect(): void {
      kind = null;
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", onFocus);
        window.removeEventListener("online", onOnline);
      }
      socket?.disconnect();
      socket = null;
    },
    connected(): boolean {
      return socket?.connected ?? false;
    },
  };
}
