// Order validation schemas and pure calculation helpers (spec 0009).
// Validates guest cart inputs, enforces 1 to 20 item bounds, checks whole
// rupiah prices, and computes order totals. No side effects.
import { z } from "zod";

export const PIN_REGEX = /^\d{6}$/;
export const MIN_ITEM_QTY = 1;
export const MAX_ITEM_QTY = 20;

export const orderItemInputSchema = z.object({
  menuItemId: z.string().trim().min(1, "Menu item id is required."),
  qty: z
    .number()
    .int("Quantity must be a whole number.")
    .min(MIN_ITEM_QTY, `Quantity must be at least ${MIN_ITEM_QTY}.`)
    .max(MAX_ITEM_QTY, `Quantity cannot exceed ${MAX_ITEM_QTY}.`),
});

export const createOrderInputSchema = z.object({
  pin: z.string().trim().regex(PIN_REGEX, "PIN must be exactly 6 digits."),
  items: z
    .array(orderItemInputSchema)
    .min(1, "Cart must contain at least one item."),
  clientTotal: z
    .number()
    .int("Total must be an integer in whole rupiah.")
    .nonnegative("Total cannot be negative."),
});

export type OrderItemInput = z.infer<typeof orderItemInputSchema>;
export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;

export interface MenuItemLookup {
  id: string;
  price: number;
  isAvailable: boolean;
  nameEn: string;
  nameId: string;
}

export interface ValidatedOrderItem {
  menuItemId: string;
  qty: number;
  unitPrice: number;
  nameEn: string;
  nameId: string;
  subtotal: number;
}

export interface OrderValidationResult {
  valid: boolean;
  unavailableItems: Array<{ menuItemId: string; nameEn: string; nameId: string }>;
  missingItems: string[];
  computedTotal: number;
  itemsWithPrices: ValidatedOrderItem[];
}

/**
 * Calculates order subtotal from item price and quantity.
 * Money is whole Indonesian Rupiah with no cents.
 */
export function calculateOrderTotal(
  items: Array<{ qty: number; unitPrice: number }>,
): number {
  return items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
}

/**
 * Validates requested items against database menu records.
 * Checks for missing items, unavailable items, and snapshots prices.
 */
export function validateOrderItems(
  requestedItems: OrderItemInput[],
  menuItems: MenuItemLookup[],
): OrderValidationResult {
  const lookup = new Map<string, MenuItemLookup>();
  for (const item of menuItems) {
    lookup.set(item.id, item);
  }

  const unavailableItems: Array<{ menuItemId: string; nameEn: string; nameId: string }> = [];
  const missingItems: string[] = [];
  const itemsWithPrices: ValidatedOrderItem[] = [];

  for (const req of requestedItems) {
    const item = lookup.get(req.menuItemId);
    if (!item) {
      missingItems.push(req.menuItemId);
      continue;
    }
    if (!item.isAvailable) {
      unavailableItems.push({
        menuItemId: item.id,
        nameEn: item.nameEn,
        nameId: item.nameId,
      });
      continue;
    }
    itemsWithPrices.push({
      menuItemId: item.id,
      qty: req.qty,
      unitPrice: item.price,
      nameEn: item.nameEn,
      nameId: item.nameId,
      subtotal: req.qty * item.price,
    });
  }

  const valid = missingItems.length === 0 && unavailableItems.length === 0;
  const computedTotal = calculateOrderTotal(itemsWithPrices);

  return {
    valid,
    unavailableItems,
    missingItems,
    computedTotal,
    itemsWithPrices,
  };
}

