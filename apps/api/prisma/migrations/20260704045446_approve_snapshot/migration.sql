-- CreateEnum
CREATE TYPE "SalesOrderStatus" AS ENUM ('DANG_SAN_XUAT', 'HOAN_THANH', 'DA_HUY');

-- CreateEnum
CREATE TYPE "ProductionOrderStatus" AS ENUM ('CHO_SAN_XUAT', 'DANG_SAN_XUAT', 'HOAN_THANH', 'DA_HUY');

-- CreateTable
CREATE TABLE "sales_orders" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "quotation_code" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_phone" TEXT NOT NULL,
    "status" "SalesOrderStatus" NOT NULL DEFAULT 'DANG_SAN_XUAT',
    "total_amount" DECIMAL(15,0) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_order_items" (
    "id" TEXT NOT NULL,
    "sales_order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "product_code" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "production_center_id" TEXT NOT NULL,
    "production_center_name" TEXT NOT NULL,
    "pricing_rule_version_id" TEXT,
    "system_price" DECIMAL(15,0) NOT NULL,
    "group_discount" DECIMAL(5,2) NOT NULL,
    "additional_discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "additional_discount_amount" DECIMAL(15,0) NOT NULL DEFAULT 0,
    "final_price" DECIMAL(15,0) NOT NULL,
    "quantity" DECIMAL(15,4) NOT NULL,
    "subtotal" DECIMAL(15,0) NOT NULL,
    "material_requirement_version_id" TEXT,
    "plan_cost" DECIMAL(15,0) NOT NULL DEFAULT 0,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_order_item_parameters" (
    "id" TEXT NOT NULL,
    "sales_order_item_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "unit" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_order_item_parameters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_boms" (
    "id" TEXT NOT NULL,
    "sales_order_id" TEXT NOT NULL,
    "sales_order_item_id" TEXT NOT NULL,
    "material_requirement_version_id" TEXT NOT NULL,
    "plan_cost" DECIMAL(15,0) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_boms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_bom_items" (
    "id" TEXT NOT NULL,
    "order_bom_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "material_code" TEXT NOT NULL,
    "material_name" TEXT NOT NULL,
    "material_unit" TEXT,
    "expression" TEXT NOT NULL,
    "waste_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "quantity" DECIMAL(15,4) NOT NULL,
    "unit_price" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(15,0) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_bom_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_orders" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sales_order_id" TEXT NOT NULL,
    "production_center_id" TEXT NOT NULL,
    "production_center_name" TEXT NOT NULL,
    "status" "ProductionOrderStatus" NOT NULL DEFAULT 'CHO_SAN_XUAT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_order_items" (
    "id" TEXT NOT NULL,
    "production_order_id" TEXT NOT NULL,
    "sales_order_item_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "product_code" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "quantity" DECIMAL(15,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_order_items_pkey" PRIMARY KEY ("id")
);

-- AlterTable: add unique constraint on quotations.sales_order_id
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_sales_order_id_key" UNIQUE ("sales_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_code_key" ON "sales_orders"("code");
CREATE INDEX "sales_orders_customer_id_idx" ON "sales_orders"("customer_id");
CREATE INDEX "sales_orders_status_idx" ON "sales_orders"("status");
CREATE INDEX "sales_order_items_sales_order_id_idx" ON "sales_order_items"("sales_order_id");
CREATE INDEX "sales_order_item_parameters_sales_order_item_id_idx" ON "sales_order_item_parameters"("sales_order_item_id");
CREATE UNIQUE INDEX "order_boms_sales_order_item_id_key" ON "order_boms"("sales_order_item_id");
CREATE INDEX "order_boms_sales_order_id_idx" ON "order_boms"("sales_order_id");
CREATE INDEX "order_bom_items_order_bom_id_idx" ON "order_bom_items"("order_bom_id");
CREATE UNIQUE INDEX "production_orders_code_key" ON "production_orders"("code");
CREATE INDEX "production_orders_sales_order_id_idx" ON "production_orders"("sales_order_id");
CREATE INDEX "production_orders_production_center_id_idx" ON "production_orders"("production_center_id");
CREATE INDEX "production_orders_status_idx" ON "production_orders"("status");
CREATE INDEX "production_order_items_production_order_id_idx" ON "production_order_items"("production_order_id");

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_item_parameters" ADD CONSTRAINT "sales_order_item_parameters_sales_order_item_id_fkey" FOREIGN KEY ("sales_order_item_id") REFERENCES "sales_order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_boms" ADD CONSTRAINT "order_boms_sales_order_item_id_fkey" FOREIGN KEY ("sales_order_item_id") REFERENCES "sales_order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_bom_items" ADD CONSTRAINT "order_bom_items_order_bom_id_fkey" FOREIGN KEY ("order_bom_id") REFERENCES "order_boms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_order_items" ADD CONSTRAINT "production_order_items_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed running numbers for new document types
INSERT INTO "running_numbers" ("id", "type", "prefix", "last_number", "padding_length", "updated_at")
SELECT gen_random_uuid()::text, 'SALES_ORDER', 'DH', 0, 6, NOW()
WHERE NOT EXISTS (SELECT 1 FROM "running_numbers" WHERE "type" = 'SALES_ORDER');

INSERT INTO "running_numbers" ("id", "type", "prefix", "last_number", "padding_length", "updated_at")
SELECT gen_random_uuid()::text, 'PRODUCTION_ORDER', 'SX', 0, 6, NOW()
WHERE NOT EXISTS (SELECT 1 FROM "running_numbers" WHERE "type" = 'PRODUCTION_ORDER');
