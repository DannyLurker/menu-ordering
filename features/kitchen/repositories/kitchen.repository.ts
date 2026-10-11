// Kitchen data access repository (spec 0010).
// All database queries take db as the first parameter. Route handlers pass prisma
// from lib/db.ts and unit tests can pass a mock client.
import type { PrismaClient } from "@/generated/client";
import type { OrderStatus } from "@/lib/realtime";

export interface KitchenOrderRow {
  id: string;
  stayId: string;
  status: OrderStatus;
  etaMinutes: number | null;
  placedAt: Date;
  verifiedAt: Date | null;
  servedAt: Date | null;
  cancelReason: string | null;
  verifiedBy: string | null;
  cancelledBy: string | null;
  stay: {
    roomNumber: string;
    guestName: string;
  };
  items: {
    id: string;
    menuItemId: string;
    qty: number;
    unitPrice: number;
    menuItem: {
      nameEn: string;
      nameId: string;
    };
  }[];
}

const ORDER_INCLUDE = {
  stay: {
    select: {
      roomNumber: true,
      guestName: true,
    },
  },
  items: {
    include: {
      menuItem: {
        select: {
          nameEn: true,
          nameId: true,
        },
      },
    },
  },
} as const;

export async function findKitchenOrderById(
  db: PrismaClient,
  id: string,
): Promise<KitchenOrderRow | null> {
  return db.order.findUnique({
    where: { id },
    include: ORDER_INCLUDE,
  }) as Promise<KitchenOrderRow | null>;
}

export async function findActiveKitchenOrders(
  db: PrismaClient,
  includeCompleted: boolean = false,
): Promise<{
  pending: KitchenOrderRow[];
  preparing: KitchenOrderRow[];
  completed: KitchenOrderRow[];
}> {
  const activeStatuses: OrderStatus[] = ["PENDING", "PREPARING"];
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

  const rows = (await db.order.findMany({
    where: {
      OR: [
        { status: { in: activeStatuses } },
        ...(includeCompleted
          ? [
              {
                status: { in: ["READY", "SERVED"] as OrderStatus[] },
                verifiedAt: { gte: twoHoursAgo },
              },
            ]
          : []),
      ],
    },
    include: ORDER_INCLUDE,
    orderBy: { placedAt: "asc" },
  })) as KitchenOrderRow[];

  const pending: KitchenOrderRow[] = [];
  const preparing: KitchenOrderRow[] = [];
  const completed: KitchenOrderRow[] = [];

  for (const row of rows) {
    if (row.status === "PENDING") {
      pending.push(row);
    } else if (row.status === "PREPARING") {
      preparing.push(row);
    } else if (row.status === "READY" || row.status === "SERVED") {
      completed.push(row);
    }
  }

  // PENDING sorted by placedAt asc (oldest first, AC-1)
  pending.sort((a, b) => a.placedAt.getTime() - b.placedAt.getTime());

  // PREPARING sorted by (verifiedAt + etaMinutes) asc (soonest ETA first, AC-1)
  preparing.sort((a, b) => {
    const aBase = a.verifiedAt ? a.verifiedAt.getTime() : a.placedAt.getTime();
    const bBase = b.verifiedAt ? b.verifiedAt.getTime() : b.placedAt.getTime();
    const aFinish = aBase + (a.etaMinutes ?? 0) * 60 * 1000;
    const bFinish = bBase + (b.etaMinutes ?? 0) * 60 * 1000;
    return aFinish - bFinish;
  });

  // Completed sorted by servedAt or verifiedAt descending (newest first)
  completed.sort((a, b) => {
    const aTime = (a.servedAt || a.verifiedAt || a.placedAt).getTime();
    const bTime = (b.servedAt || b.verifiedAt || b.placedAt).getTime();
    return bTime - aTime;
  });

  return { pending, preparing, completed };
}

export async function updateOrderToPreparing(
  db: PrismaClient,
  id: string,
  etaMinutes: number,
  verifiedBy: string,
  verifiedAt: Date = new Date(),
): Promise<KitchenOrderRow> {
  return db.order.update({
    where: { id },
    data: {
      status: "PREPARING",
      etaMinutes,
      verifiedBy,
      verifiedAt,
    },
    include: ORDER_INCLUDE,
  }) as Promise<KitchenOrderRow>;
}

export async function updateOrderEta(
  db: PrismaClient,
  id: string,
  etaMinutes: number,
): Promise<KitchenOrderRow> {
  return db.order.update({
    where: { id },
    data: {
      etaMinutes,
    },
    include: ORDER_INCLUDE,
  }) as Promise<KitchenOrderRow>;
}

export async function updateOrderToReady(
  db: PrismaClient,
  id: string,
): Promise<KitchenOrderRow> {
  return db.order.update({
    where: { id },
    data: {
      status: "READY",
    },
    include: ORDER_INCLUDE,
  }) as Promise<KitchenOrderRow>;
}

export async function updateOrderToServed(
  db: PrismaClient,
  id: string,
  servedAt: Date = new Date(),
): Promise<KitchenOrderRow> {
  return db.order.update({
    where: { id },
    data: {
      status: "SERVED",
      servedAt,
    },
    include: ORDER_INCLUDE,
  }) as Promise<KitchenOrderRow>;
}

export async function updateOrderToCancelled(
  db: PrismaClient,
  id: string,
  cancelReason: string,
  cancelledBy: string,
): Promise<KitchenOrderRow> {
  return db.order.update({
    where: { id },
    data: {
      status: "KITCHEN_CANCELLED",
      cancelReason,
      cancelledBy,
    },
    include: ORDER_INCLUDE,
  }) as Promise<KitchenOrderRow>;
}
