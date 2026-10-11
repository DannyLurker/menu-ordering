// Types for the kitchen domain slice (spec 0010).
import type { OrderStatus } from "@/lib/realtime";

export interface KitchenOrderItem {
  id: string;
  menuItemId: string;
  nameEn: string;
  nameId: string;
  qty: number;
  unitPrice: number;
}

export interface KitchenOrder {
  id: string;
  stayId: string;
  roomNumber: string;
  guestName: string;
  status: OrderStatus;
  etaMinutes: number | null;
  placedAt: string;
  verifiedAt: string | null;
  servedAt: string | null;
  cancelReason: string | null;
  verifiedBy: string | null;
  cancelledBy: string | null;
  items: KitchenOrderItem[];
}

export interface ActiveKitchenOrders {
  pending: KitchenOrder[];
  preparing: KitchenOrder[];
  completed: KitchenOrder[];
}

export interface VerifyOrderResult {
  orderId: string;
  stayId: string;
  status: OrderStatus;
  verifiedAt: string;
  etaMinutes: number;
}

export interface UpdateEtaResult {
  orderId: string;
  stayId: string;
  status: OrderStatus;
  etaMinutes: number;
}

export interface MarkReadyResult {
  orderId: string;
  stayId: string;
  status: OrderStatus;
}

export interface MarkServedResult {
  orderId: string;
  stayId: string;
  status: OrderStatus;
  servedAt: string;
}

export interface CancelOrderResult {
  orderId: string;
  stayId: string;
  status: OrderStatus;
  cancelReason: string;
}
