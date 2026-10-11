// Server side emit for the realtime foundation (spec 0007). Holds the
// socket server that server.ts boots and fans order events into the
// owning stay room plus the kitchen room. Only the server calls these,
// and only after the REST write commits, so client emitted order state
// can never reach a room. Route handlers import the emit functions;
// server.ts registers the live instance once at boot. Before boot (build
// time prerender, unit tests) the helpers validate the payload and
// report false instead of throwing, so callers stay simple.
import type { Server as SocketServer } from "socket.io";
import {
  KITCHEN_ROOM,
  ORDER_CREATED,
  ORDER_STATUS_CHANGED,
  buildOrderCreated,
  buildOrderStatusChanged,
  stayRoom,
  type OrderEventPayload,
} from "./realtime";

let live: SocketServer | null = null;

/** Called once by server.ts at boot. Test code may pass null to reset. */
export function setRealtimeServer(server: SocketServer | null): void {
  live = server;
}

function fanout(event: string, payload: OrderEventPayload): boolean {
  if (!live) return false;
  live.to(stayRoom(payload.stayId)).to(KITCHEN_ROOM).emit(event, payload);
  console.log(
    `[realtime] emit event=${event} stay=${payload.stayId} order=${payload.orderId} status=${payload.status}`,
  );
  return true;
}

/** Fan `order.created` for a new PENDING order (AC-1). */
export function emitOrderCreated(input: {
  stayId: unknown;
  orderId: unknown;
}): boolean {
  return fanout(ORDER_CREATED, buildOrderCreated(input));
}

/** Fan `order.status.changed` with ETA in minutes or null (AC-2). */
export function emitOrderStatusChanged(input: {
  stayId: unknown;
  orderId: unknown;
  status: unknown;
  etaMinutes: unknown;
}): boolean {
  return fanout(ORDER_STATUS_CHANGED, buildOrderStatusChanged(input));
}
