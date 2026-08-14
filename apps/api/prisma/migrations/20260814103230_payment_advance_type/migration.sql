-- AlterEnum
ALTER TYPE "PaymentType" ADD VALUE 'ADVANCE';

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "customer_id" TEXT;

-- CreateIndex
CREATE INDEX "payments_customer_id_idx" ON "payments"("customer_id");
