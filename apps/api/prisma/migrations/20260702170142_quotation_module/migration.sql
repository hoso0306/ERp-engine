/*
  Warnings:

  - Made the column `production_center_id` on table `products` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'SENT', 'APPROVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QuotationTimelineAction" AS ENUM ('QUOTATION_CREATED', 'QUOTATION_SENT', 'QUOTATION_APPROVED', 'QUOTATION_CANCELLED', 'QUOTATION_MANUAL_OVERRIDE');

-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_production_center_id_fkey";

-- AlterTable
ALTER TABLE "customer_groups" ADD COLUMN     "discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "products" ALTER COLUMN "production_center_id" SET NOT NULL;

-- CreateTable
CREATE TABLE "quotations" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "expiry_date" TIMESTAMP(3),
    "note" TEXT,
    "sales_order_id" TEXT,
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_items" (
    "id" TEXT NOT NULL,
    "quotation_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" DECIMAL(15,4) NOT NULL,
    "pricing_rule_version_id" TEXT,
    "material_requirement_version_id" TEXT,
    "system_price" DECIMAL(15,0) NOT NULL DEFAULT 0,
    "group_discount" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "additional_discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "additional_discount_amount" DECIMAL(15,0) NOT NULL DEFAULT 0,
    "discount_reason" TEXT,
    "final_price" DECIMAL(15,0) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(15,0) NOT NULL DEFAULT 0,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_item_parameters" (
    "id" TEXT NOT NULL,
    "quotation_item_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "unit" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotation_item_parameters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_timelines" (
    "id" TEXT NOT NULL,
    "quotation_id" TEXT NOT NULL,
    "action" "QuotationTimelineAction" NOT NULL,
    "payload" JSONB,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotation_timelines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quotations_code_key" ON "quotations"("code");

-- CreateIndex
CREATE INDEX "quotations_customer_id_idx" ON "quotations"("customer_id");

-- CreateIndex
CREATE INDEX "quotations_status_idx" ON "quotations"("status");

-- CreateIndex
CREATE INDEX "quotations_sales_order_id_idx" ON "quotations"("sales_order_id");

-- CreateIndex
CREATE INDEX "quotations_expiry_date_idx" ON "quotations"("expiry_date");

-- CreateIndex
CREATE INDEX "quotation_items_quotation_id_idx" ON "quotation_items"("quotation_id");

-- CreateIndex
CREATE INDEX "quotation_items_product_id_idx" ON "quotation_items"("product_id");

-- CreateIndex
CREATE INDEX "quotation_item_parameters_quotation_item_id_idx" ON "quotation_item_parameters"("quotation_item_id");

-- CreateIndex
CREATE INDEX "quotation_timelines_quotation_id_idx" ON "quotation_timelines"("quotation_id");

-- CreateIndex
CREATE INDEX "quotation_timelines_quotation_id_created_at_idx" ON "quotation_timelines"("quotation_id", "created_at");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_production_center_id_fkey" FOREIGN KEY ("production_center_id") REFERENCES "production_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_item_parameters" ADD CONSTRAINT "quotation_item_parameters_quotation_item_id_fkey" FOREIGN KEY ("quotation_item_id") REFERENCES "quotation_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_timelines" ADD CONSTRAINT "quotation_timelines_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
