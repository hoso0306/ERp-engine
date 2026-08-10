-- AlterEnum
ALTER TYPE "OpeningBalanceTimelineAction" ADD VALUE 'OPENING_BALANCE_PAID';

-- DropForeignKey
ALTER TABLE "payment_allocations" DROP CONSTRAINT "payment_allocations_receivable_id_fkey";

-- AlterTable
ALTER TABLE "payment_allocations" ADD COLUMN     "opening_balance_id" TEXT,
ALTER COLUMN "receivable_id" DROP NOT NULL,
ALTER COLUMN "sales_order_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "payment_allocations_opening_balance_id_idx" ON "payment_allocations"("opening_balance_id");

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_receivable_id_fkey" FOREIGN KEY ("receivable_id") REFERENCES "receivables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_opening_balance_id_fkey" FOREIGN KEY ("opening_balance_id") REFERENCES "opening_balances"("id") ON DELETE SET NULL ON UPDATE CASCADE;
