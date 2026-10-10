-- Store level guards for spec 0002 invariants (review follow up).
-- Prisma schema language has no CHECK or partial index support, so these live
-- here in SQL, mirrored by comments in prisma/schema.prisma (same pattern as
-- the Stay partial unique index in the first migration).

-- Stay dates valid and PIN counters sane (AC-1, AC-5).
ALTER TABLE "Stay" ADD CONSTRAINT "Stay_dates_chk" CHECK ("checkOut" > "checkIn");
ALTER TABLE "Stay" ADD CONSTRAINT "Stay_pin_attempts_chk" CHECK ("failedPinAttempts" >= 0);

-- Menu price in whole rupiah, never negative (AC-3).
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_price_chk" CHECK ("price" >= 0);

-- Order line bounds plus snapshot price sanity (AC-3, AC-9).
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_qty_chk" CHECK ("qty" >= 1 AND "qty" <= 20);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_unit_price_chk" CHECK ("unitPrice" >= 0);

-- Duplicate lines merge by menuItemId at order time (spec 0002 data model sketch).
CREATE UNIQUE INDEX "OrderItem_order_menu_item_key" ON "OrderItem"("orderId", "menuItemId");

-- Kitchen ETA range, nullable until verify (AC-7).
ALTER TABLE "Order" ADD CONSTRAINT "Order_eta_chk" CHECK ("etaMinutes" IS NULL OR ("etaMinutes" >= 5 AND "etaMinutes" <= 120));

-- Folio amounts from snapshot prices, never negative (AC-4, AC-9).
ALTER TABLE "FolioLine" ADD CONSTRAINT "FolioLine_amount_chk" CHECK ("amount" >= 0);
CREATE INDEX "FolioLine_orderItemId_idx" ON "FolioLine"("orderItemId");

-- Payment amounts never negative; one active payment per order so no partial
-- payments, while VOID rows keep history and allow a later re-record (AC-8).
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_chk" CHECK ("amount" >= 0);
CREATE UNIQUE INDEX "Payment_order_active_key" ON "Payment"("orderId") WHERE "status" = 'RECORDED';
