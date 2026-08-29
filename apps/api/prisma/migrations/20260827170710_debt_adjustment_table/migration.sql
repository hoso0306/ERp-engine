-- CreateTable
CREATE TABLE "debt_adjustments" (
    "id" TEXT NOT NULL,
    "receivable_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "sales_order_id" TEXT NOT NULL,
    "return_id" TEXT,
    "amount" DECIMAL(15,0) NOT NULL,
    "reason" TEXT NOT NULL,
    "owner_id" TEXT,
    "owner_name" TEXT,
    "created_by" TEXT,
    "created_by_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debt_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "debt_adjustments_customer_id_created_at_idx" ON "debt_adjustments"("customer_id", "created_at");

-- CreateIndex
CREATE INDEX "debt_adjustments_return_id_idx" ON "debt_adjustments"("return_id");

-- CreateIndex
CREATE INDEX "debt_adjustments_sales_order_id_idx" ON "debt_adjustments"("sales_order_id");

-- AddForeignKey
ALTER TABLE "debt_adjustments" ADD CONSTRAINT "debt_adjustments_receivable_id_fkey" FOREIGN KEY ("receivable_id") REFERENCES "receivables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_adjustments" ADD CONSTRAINT "debt_adjustments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
