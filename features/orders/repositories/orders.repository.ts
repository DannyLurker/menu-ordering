// Order data access repository (spec 0009).
// All database queries take db as the first parameter. Route handlers pass prisma
// from lib/db.ts and unit tests can pass a mock client.
import type { PrismaClient } from "@/generated/client";

export interface CreateOrderItemRow {
  menuItemId: string;
  qty: number;
  unitPrice: number;
}

export async function findStayForOrdering(db: PrismaClient, stayId: string) {
  return db.stay.findUnique({
    where: { id: stayId },
    select: {
      id: true,
      roomNumber: true,
      guestName: true,
      status: true,
      checkIn: true,
      checkOut: true,
      pinHash: true,
      failedPinAttempts: true,
      pinLocked: true,
    },
  });
}

export async function recordStayWrongPin(
  db: PrismaClient,
  stayId: string,
  attempts: number,
  locked: boolean,
) {
  return db.stay.update({
    where: { id: stayId },
    data: {
      failedPinAttempts: attempts,
      pinLocked: locked,
    },
  });
}

export async function resetStayPinAttempts(db: PrismaClient, stayId: string) {
  return db.stay.update({
    where: { id: stayId },
    data: {
      failedPinAttempts: 0,
    },
  });
}

export async function updateStayPinHash(
  db: PrismaClient,
  stayId: string,
  pinHash: string,
) {
  return db.stay.update({
    where: { id: stayId },
    data: {
      pinHash,
    },
  });
}

export async function findMenuItemsByIds(db: PrismaClient, ids: string[]) {
  return db.menuItem.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      price: true,
      isAvailable: true,
      nameEn: true,
      nameId: true,
    },
  });
}

export async function createOrderWithItems(
  db: PrismaClient,
  stayId: string,
  items: CreateOrderItemRow[],
) {
  return db.$transaction(async (tx) => {
    return tx.order.create({
      data: {
        stayId,
        status: "PENDING",
        items: {
          create: items.map((i) => ({
            menuItemId: i.menuItemId,
            qty: i.qty,
            unitPrice: i.unitPrice,
          })),
        },
      },
      include: {
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
      },
    });
  });
}

export async function findOrdersByStayId(db: PrismaClient, stayId: string) {
  return db.order.findMany({
    where: { stayId },
    orderBy: { placedAt: "desc" },
    include: {
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
    },
  });
}

export async function findMenuCategoriesWithItems(db: PrismaClient) {
  return db.menuCategory.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: {
      items: {
        where: { isAvailable: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
}

