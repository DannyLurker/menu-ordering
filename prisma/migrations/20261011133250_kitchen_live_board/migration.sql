-- AlterTable: add kitchen actor tracking and cancel reason columns
ALTER TABLE "Order" ADD COLUMN "cancelReason" TEXT,
ADD COLUMN "cancelledBy" TEXT,
ADD COLUMN "verifiedBy" TEXT;

-- CreateIndex
CREATE INDEX "Order_verifiedBy_idx" ON "Order"("verifiedBy");
CREATE INDEX "Order_cancelledBy_idx" ON "Order"("cancelledBy");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_cancelledBy_fkey" FOREIGN KEY ("cancelledBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Widen etaMinutes check constraint from 5..120 to 1..120 (AC-3)
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_eta_chk";
ALTER TABLE "Order" ADD CONSTRAINT "Order_eta_chk" CHECK ("etaMinutes" IS NULL OR ("etaMinutes" >= 1 AND "etaMinutes" <= 120));

-- Cancel reason length check constraint (AC-7)
ALTER TABLE "Order" ADD CONSTRAINT "Order_cancel_reason_len_chk" CHECK ("cancelReason" IS NULL OR (length("cancelReason") >= 1 AND length("cancelReason") <= 200));
