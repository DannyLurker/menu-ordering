// Tests for order schemas and calculation logic (spec 0009).
import { describe, expect, it } from "vitest";
import {
  calculateOrderTotal,
  createOrderInputSchema,
  orderItemInputSchema,
  validateOrderItems,
} from "./orders.schemas";

describe("order schemas", () => {
  it("accepts valid item quantities between 1 and 20", () => {
    const validLow = orderItemInputSchema.parse({ menuItemId: "item-1", qty: 1 });
    const validHigh = orderItemInputSchema.parse({ menuItemId: "item-1", qty: 20 });
    expect(validLow.qty).toBe(1);
    expect(validHigh.qty).toBe(20);
  });

  it("rejects item quantities below 1 or above 20", () => {
    expect(() => orderItemInputSchema.parse({ menuItemId: "item-1", qty: 0 })).toThrow();
    expect(() => orderItemInputSchema.parse({ menuItemId: "item-1", qty: 21 })).toThrow();
    expect(() => orderItemInputSchema.parse({ menuItemId: "item-1", qty: 2.5 })).toThrow();
  });

  it("rejects non-integer quantities", () => {
    expect(() => orderItemInputSchema.parse({ menuItemId: "item-1", qty: 1.5 })).toThrow();
    expect(() => orderItemInputSchema.parse({ menuItemId: "item-1", qty: Number.NaN })).toThrow();
  });

  it("requires a non-empty menu item identifier", () => {
    expect(() => orderItemInputSchema.parse({ menuItemId: "", qty: 1 })).toThrow();
    expect(() => orderItemInputSchema.parse({ menuItemId: "   ", qty: 1 })).toThrow();
  });

  it("requires a 6 digit PIN and at least one item", () => {
    expect(() =>
      createOrderInputSchema.parse({
        pin: "12345",
        items: [{ menuItemId: "item-1", qty: 2 }],
        clientTotal: 50000,
      }),
    ).toThrow();

    expect(() =>
      createOrderInputSchema.parse({
        pin: "1234567",
        items: [{ menuItemId: "item-1", qty: 2 }],
        clientTotal: 50000,
      }),
    ).toThrow();

    expect(() =>
      createOrderInputSchema.parse({
        pin: "abcdef",
        items: [{ menuItemId: "item-1", qty: 2 }],
        clientTotal: 50000,
      }),
    ).toThrow();

    expect(() =>
      createOrderInputSchema.parse({
        pin: "123456",
        items: [],
        clientTotal: 50000,
      }),
    ).toThrow();

    const valid = createOrderInputSchema.parse({
      pin: "123456",
      items: [{ menuItemId: "item-1", qty: 2 }],
      clientTotal: 50000,
    });
    expect(valid.pin).toBe("123456");
  });

  it("rejects negative client total", () => {
    expect(() =>
      createOrderInputSchema.parse({
        pin: "123456",
        items: [{ menuItemId: "item-1", qty: 1 }],
        clientTotal: -1,
      }),
    ).toThrow();
  });

  it("rejects non-integer client total", () => {
    expect(() =>
      createOrderInputSchema.parse({
        pin: "123456",
        items: [{ menuItemId: "item-1", qty: 1 }],
        clientTotal: 50000.5,
      }),
    ).toThrow();
  });
});

describe("calculateOrderTotal", () => {
  it("sums item price multiplied by quantity in whole rupiah", () => {
    const total = calculateOrderTotal([
      { qty: 2, unitPrice: 75000 },
      { qty: 1, unitPrice: 25000 },
    ]);
    expect(total).toBe(175000);
  });

  it("returns zero for an empty list", () => {
    expect(calculateOrderTotal([])).toBe(0);
  });

  it("handles a single item", () => {
    expect(calculateOrderTotal([{ qty: 3, unitPrice: 10000 }])).toBe(30000);
  });

  it("handles maximum quantity per item", () => {
    expect(calculateOrderTotal([{ qty: 20, unitPrice: 5000 }])).toBe(100000);
  });
});

describe("validateOrderItems", () => {
  const catalog = [
    {
      id: "item-nasgor",
      price: 75000,
      isAvailable: true,
      nameEn: "Nasi Goreng",
      nameId: "Nasi Goreng",
    },
    {
      id: "item-tea",
      price: 25000,
      isAvailable: true,
      nameEn: "Sweet Iced Tea",
      nameId: "Es Teh Manis",
    },
    {
      id: "item-soup",
      price: 60000,
      isAvailable: false,
      nameEn: "Oxtail Soup",
      nameId: "Sop Buntut",
    },
  ];

  it("validates available items and computes snapshot prices", () => {
    const result = validateOrderItems(
      [
        { menuItemId: "item-nasgor", qty: 2 },
        { menuItemId: "item-tea", qty: 1 },
      ],
      catalog,
    );

    expect(result.valid).toBe(true);
    expect(result.computedTotal).toBe(175000);
    expect(result.itemsWithPrices).toHaveLength(2);
    expect(result.itemsWithPrices[0].unitPrice).toBe(75000);
  });

  it("identifies unavailable items and flags result as invalid", () => {
    const result = validateOrderItems(
      [
        { menuItemId: "item-nasgor", qty: 1 },
        { menuItemId: "item-soup", qty: 1 },
      ],
      catalog,
    );

    expect(result.valid).toBe(false);
    expect(result.unavailableItems).toHaveLength(1);
    expect(result.unavailableItems[0].menuItemId).toBe("item-soup");
    expect(result.unavailableItems[0].nameEn).toBe("Oxtail Soup");
  });

  it("identifies missing item identifiers", () => {
    const result = validateOrderItems([{ menuItemId: "unknown-id", qty: 1 }], catalog);
    expect(result.valid).toBe(false);
    expect(result.missingItems).toContain("unknown-id");
  });

  it("flags both missing and unavailable items in the same request", () => {
    const result = validateOrderItems(
      [
        { menuItemId: "item-soup", qty: 1 },
        { menuItemId: "unknown-id", qty: 1 },
      ],
      catalog,
    );

    expect(result.valid).toBe(false);
    expect(result.unavailableItems).toHaveLength(1);
    expect(result.missingItems).toHaveLength(1);
  });

  it("returns empty result for an empty items list", () => {
    const result = validateOrderItems([], catalog);
    expect(result.valid).toBe(true);
    expect(result.computedTotal).toBe(0);
    expect(result.itemsWithPrices).toHaveLength(0);
  });

  it("does not mutate the input catalog", () => {
    const catalogSnapshot = JSON.stringify(catalog);
    validateOrderItems([{ menuItemId: "item-nasgor", qty: 1 }], catalog);
    expect(JSON.stringify(catalog)).toBe(catalogSnapshot);
  });
});
