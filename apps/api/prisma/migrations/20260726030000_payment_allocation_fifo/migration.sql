-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('NORMAL', 'REVERSAL');

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_receivable_id_fkey";

-- DropIndex
DROP INDEX "payments_receivable_id_idx";

-- DropIndex
DROP INDEX "payments_sales_order_id_idx";

-- AlterTable
ALTER TABLE "payments" DROP COLUMN "receivable_id",
DROP COLUMN "sales_order_id",
ADD COLUMN     "reversal_of_payment_id" TEXT,
ADD COLUMN     "type" "PaymentType" NOT NULL DEFAULT 'NORMAL';

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "receivable_id" TEXT NOT NULL,
    "sales_order_id" TEXT NOT NULL,
    "allocated_subtotal" DECIMAL(15,0) NOT NULL,
    "allocated_vat" DECIMAL(15,0) NOT NULL,
    "allocated_total" DECIMAL(15,0) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_allocations_payment_id_idx" ON "payment_allocations"("payment_id");

-- CreateIndex
CREATE INDEX "payment_allocations_receivable_id_idx" ON "payment_allocations"("receivable_id");

-- CreateIndex
CREATE INDEX "payment_allocations_sales_order_id_idx" ON "payment_allocations"("sales_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_reversal_of_payment_id_key" ON "payments"("reversal_of_payment_id");

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_receivable_id_fkey" FOREIGN KEY ("receivable_id") REFERENCES "receivables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_reversal_of_payment_id_fkey" FOREIGN KEY ("reversal_of_payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
