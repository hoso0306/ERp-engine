-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER');

-- CreateTable
CREATE TABLE "receivables" (
    "id" TEXT NOT NULL,
    "sales_order_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "total_amount" DECIMAL(15,0) NOT NULL,
    "paid_amount" DECIMAL(15,0) NOT NULL DEFAULT 0,
    "remaining_amount" DECIMAL(15,0) NOT NULL,
    "debt_limit_snapshot" DECIMAL(15,0) NOT NULL,
    "debt_term_days_snapshot" INTEGER NOT NULL,
    "due_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receivables_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "receivables_remaining_amount_check" CHECK ("remaining_amount" >= 0)
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sales_order_id" TEXT NOT NULL,
    "receivable_id" TEXT NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(15,0) NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL,
    "reference_number" TEXT,
    "note" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "receivables_sales_order_id_key" ON "receivables"("sales_order_id");

-- CreateIndex
CREATE INDEX "receivables_customer_id_idx" ON "receivables"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_code_key" ON "payments"("code");

-- CreateIndex
CREATE INDEX "payments_sales_order_id_idx" ON "payments"("sales_order_id");

-- CreateIndex
CREATE INDEX "payments_receivable_id_idx" ON "payments"("receivable_id");

-- AddForeignKey
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_receivable_id_fkey" FOREIGN KEY ("receivable_id") REFERENCES "receivables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed running number for Payment (Task 00 — module Debt)
INSERT INTO "running_numbers" ("id", "type", "prefix", "last_number", "padding_length", "updated_at")
SELECT gen_random_uuid()::text, 'PAYMENT', 'PT', 0, 6, NOW()
WHERE NOT EXISTS (SELECT 1 FROM "running_numbers" WHERE "type" = 'PAYMENT');
