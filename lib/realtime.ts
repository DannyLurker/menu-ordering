// Shared realtime contract (spec 0007). One room plan plus one event
// shape every later slice builds on, so kitchen plus guest screens stay
// aligned with no per slice invention. This module is pure: no Next, no
// Node, no database. Server code (server.ts), route handlers, and browser
// code all import from here.
//
// Rooms: one room per stay plus one fixed kitchen room. Names are derived
// server side from verified sessions, never from client claim.
//   stay room:    stay:stay:{stayId}
//   kitchen room: kitchen:board
//
// Events: clients emit join and leave only. Only the server emits order
// state, and only after the REST write commits. Screens treat events as
// hints and refetch REST truth; on reconnect plus on focus they rejoin
// then refetch.
//
// Budgets (all per 15 min window, LRU speed with Postgres truth):
//   sign in:      5 per account plus 20 per IP
//   stay mint:    5 per stay plus 20 per IP
//   socket join:  5 per stay or account plus 20 per IP (same keys as above)
//   order create: 20 per stay plus 60 per IP (enforced by slice 7)
//
// Single instance only in V1.1: rooms plus LRU counters are local memory,
// so a second host would split them. See spec 0007 Consequences.

export const STAY_COOKIE = "stay_session";

export const KITCHEN_ROOM = "kitchen:board";

export function stayRoom(stayId: string): string {
  return `stay:stay:${stayId}`;
}

export const JOIN_STAY = "join.stay";
export const JOIN_KITCHEN = "join.kitchen";
export const LEAVE_STAY = "leave.stay";
export const LEAVE_KITCHEN = "leave.kitchen";
export const ORDER_CREATED = "order.created";
export const ORDER_STATUS_CHANGED = "order.status.changed";
export const JOIN_DENIED = "join.denied";

export const RATE_LIMIT_CODE = "RATE_LIMITED";

/** Throttle copy: LRU budget spent, retry after the hinted seconds. */
export const THROTTLE_MESSAGE = "Please wait a moment and try again.";

/** Lock copy: durable lock set, only staff can restore access. */
export const LOCK_MESSAGE = "Locked. Please call staff for help.";

export const ORDER_STATUSES = [
  "PENDING",
  "PREPARING",
  "READY",
  "SERVED",
  "GUEST_CANCELLED",
  "KITCHEN_CANCELLED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export function isOrderStatus(value: unknown): value is OrderStatus {
  return (
    typeof value === "string" &&
    (ORDER_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * The only order payload shape on the wire (AC-8). Ids plus status plus
 * ETA and nothing else: no PIN, no token, no name, no timestamps.
 */
export interface OrderEventPayload {
  stayId: string;
  orderId: string;
  status: OrderStatus;
  etaMinutes: number | null;
}

function checkedPayload(input: {
  stayId: unknown;
  orderId: unknown;
  status: unknown;
  etaMinutes: unknown;
}): OrderEventPayload {
  const { stayId, orderId, status, etaMinutes } = input;
  if (typeof stayId !== "string" || stayId.length === 0) {
    throw new Error("Order event needs a stay id.");
  }
  if (typeof orderId !== "string" || orderId.length === 0) {
    throw new Error("Order event needs an order id.");
  }
  if (!isOrderStatus(status)) {
    throw new Error("Order event needs a known status.");
  }
  if (
    etaMinutes !== null &&
    (typeof etaMinutes !== "number" ||
      !Number.isInteger(etaMinutes) ||
      etaMinutes < 0)
  ) {
    throw new Error("ETA must be whole minutes or null.");
  }
  return { stayId, orderId, status, etaMinutes };
}

/** Payload for a new PENDING order (AC-1). ETA is always null here. */
export function buildOrderCreated(input: {
  stayId: unknown;
  orderId: unknown;
}): OrderEventPayload {
  return checkedPayload({
    stayId: input.stayId,
    orderId: input.orderId,
    status: "PENDING",
    etaMinutes: null,
  });
}

/** Payload for a status or ETA change (AC-2). */
export function buildOrderStatusChanged(input: {
  stayId: unknown;
  orderId: unknown;
  status: unknown;
  etaMinutes: unknown;
}): OrderEventPayload {
  return checkedPayload(input);
}

export interface JoinOk {
  ok: true;
  room: string;
}

export interface JoinDenial {
  ok: false;
  code: string;
  retryAfterSec: number;
}

export type JoinResult = JoinOk | JoinDenial;

export function joinDenied(code: string, retryAfterSec: number): JoinDenial {
  return { ok: false, code, retryAfterSec };
}
