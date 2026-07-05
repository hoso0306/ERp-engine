-- CreateEnum
CREATE TYPE "ReturnReason" AS ENUM ('WRONG_SIZE', 'WRONG_COLOR', 'WRONG_MODEL', 'PRODUCTION_DEFECT', 'INSTALLATION_DEFECT', 'CUSTOMER_CHANGED_MIND', 'OTHER');

-- CreateEnum
CREATE TYPE "RecoveryInventoryStatus" AS ENUM ('AVAILABLE', 'USED', 'DISPOSED');

-- CreateTable
CREATE TABLE "returns" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sales_order_id" TEXT NOT NULL,
    "sales_order_code" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "return_date" TIMESTAMP(3) NOT NULL,
    "received_by" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_items" (
    "id" TEXT NOT NULL,
    "return_id" TEXT NOT NULL,
    "sales_order_item_id" TEXT NOT NULL,
    "product_code" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "product_parameters" JSONB,
    "ordered_quantity" DECIMAL(15,4) NOT NULL,
    "returned_quantity" DECIMAL(15,4) NOT NULL,
    "unit_price_snapshot" DECIMAL(15,0) NOT NULL,
    "reason" "ReturnReason" NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "return_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_inventories" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "return_item_id" TEXT NOT NULL,
    "created_from_return_code" TEXT NOT NULL,
    "product_code" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "product_parameters" JSONB,
    "quantity" DECIMAL(15,4) NOT NULL,
    "location" TEXT,
    "status" "RecoveryInventoryStatus" NOT NULL DEFAULT 'AVAILABLE',
    "image_url" TEXT,
    "used_for_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recovery_inventories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "returns_code_key" ON "returns"("code");

-- CreateIndex
CREATE INDEX "returns_sales_order_id_idx" ON "returns"("sales_order_id");

-- CreateIndex
CREATE INDEX "returns_customer_id_idx" ON "returns"("customer_id");

-- CreateIndex
CREATE INDEX "return_items_return_id_idx" ON "return_items"("return_id");

-- CreateIndex
CREATE INDEX "return_items_sales_order_item_id_idx" ON "return_items"("sales_order_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "recovery_inventories_code_key" ON "recovery_inventories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "recovery_inventories_return_item_id_key" ON "recovery_inventories"("return_item_id");

-- CreateIndex
CREATE INDEX "recovery_inventories_status_idx" ON "recovery_inventories"("status");

-- CreateIndex
CREATE INDEX "recovery_inventories_status_created_at_idx" ON "recovery_inventories"("status", "created_at");

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_inventories" ADD CONSTRAINT "recovery_inventories_return_item_id_fkey" FOREIGN KEY ("return_item_id") REFERENCES "return_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
