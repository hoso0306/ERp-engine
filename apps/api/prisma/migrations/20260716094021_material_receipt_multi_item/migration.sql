-- DropForeignKey
ALTER TABLE "material_receipts" DROP CONSTRAINT "material_receipts_material_id_fkey";

-- DropForeignKey
ALTER TABLE "warehouse_transactions" DROP CONSTRAINT "warehouse_transactions_material_receipt_id_fkey";

-- DropIndex
DROP INDEX "material_receipts_material_id_idx";

-- DropIndex
DROP INDEX "warehouse_transactions_material_receipt_id_key";

-- AlterTable
ALTER TABLE "material_receipts" DROP COLUMN "material_code",
DROP COLUMN "material_id",
DROP COLUMN "material_name",
DROP COLUMN "quantity",
DROP COLUMN "unit";

-- AlterTable
ALTER TABLE "warehouse_transactions" DROP COLUMN "material_receipt_id",
ADD COLUMN     "material_receipt_item_id" TEXT;

-- CreateTable
CREATE TABLE "material_receipt_items" (
    "id" TEXT NOT NULL,
    "material_receipt_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "material_code" TEXT NOT NULL,
    "material_name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DECIMAL(15,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_receipt_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "material_receipt_items_material_receipt_id_idx" ON "material_receipt_items"("material_receipt_id");

-- CreateIndex
CREATE INDEX "material_receipt_items_material_id_idx" ON "material_receipt_items"("material_id");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_transactions_material_receipt_item_id_key" ON "warehouse_transactions"("material_receipt_item_id");

-- AddForeignKey
ALTER TABLE "material_receipt_items" ADD CONSTRAINT "material_receipt_items_material_receipt_id_fkey" FOREIGN KEY ("material_receipt_id") REFERENCES "material_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_receipt_items" ADD CONSTRAINT "material_receipt_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_transactions" ADD CONSTRAINT "warehouse_transactions_material_receipt_item_id_fkey" FOREIGN KEY ("material_receipt_item_id") REFERENCES "material_receipt_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

