-- CreateEnum
CREATE TYPE "WarehouseDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "WarehouseTransactionType" AS ENUM ('MATERIAL_RECEIPT', 'MATERIAL_ISSUE');

-- AlterTable
ALTER TABLE "materials" ADD COLUMN     "current_stock" DECIMAL(15,4) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "material_receipts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "material_code" TEXT NOT NULL,
    "material_name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DECIMAL(15,4) NOT NULL,
    "supplier_name" TEXT,
    "note" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_transactions" (
    "id" TEXT NOT NULL,
    "direction" "WarehouseDirection" NOT NULL,
    "transaction_type" "WarehouseTransactionType" NOT NULL,
    "material_id" TEXT NOT NULL,
    "material_code" TEXT NOT NULL,
    "material_name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DECIMAL(15,4) NOT NULL,
    "material_receipt_id" TEXT,
    "production_order_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warehouse_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "material_receipts_code_key" ON "material_receipts"("code");

-- CreateIndex
CREATE INDEX "material_receipts_material_id_idx" ON "material_receipts"("material_id");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_transactions_material_receipt_id_key" ON "warehouse_transactions"("material_receipt_id");

-- CreateIndex
CREATE INDEX "warehouse_transactions_material_id_idx" ON "warehouse_transactions"("material_id");

-- CreateIndex
CREATE INDEX "warehouse_transactions_production_order_id_idx" ON "warehouse_transactions"("production_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_transactions_production_order_id_material_id_key" ON "warehouse_transactions"("production_order_id", "material_id");

-- AddForeignKey
ALTER TABLE "material_receipts" ADD CONSTRAINT "material_receipts_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_transactions" ADD CONSTRAINT "warehouse_transactions_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_transactions" ADD CONSTRAINT "warehouse_transactions_material_receipt_id_fkey" FOREIGN KEY ("material_receipt_id") REFERENCES "material_receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_transactions" ADD CONSTRAINT "warehouse_transactions_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
