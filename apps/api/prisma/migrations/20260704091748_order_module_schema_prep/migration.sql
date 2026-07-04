-- Rename SalesOrderStatus values to English + add SHIPPED, DELIVERED
ALTER TYPE "SalesOrderStatus" RENAME VALUE 'DANG_SAN_XUAT' TO 'IN_PRODUCTION';
ALTER TYPE "SalesOrderStatus" RENAME VALUE 'HOAN_THANH' TO 'PRODUCTION_COMPLETED';
ALTER TYPE "SalesOrderStatus" RENAME VALUE 'DA_HUY' TO 'CANCELLED';
ALTER TYPE "SalesOrderStatus" ADD VALUE 'SHIPPED' AFTER 'PRODUCTION_COMPLETED';
ALTER TYPE "SalesOrderStatus" ADD VALUE 'DELIVERED' AFTER 'SHIPPED';

-- Rename ProductionOrderStatus values to English
ALTER TYPE "ProductionOrderStatus" RENAME VALUE 'CHO_SAN_XUAT' TO 'PENDING';
ALTER TYPE "ProductionOrderStatus" RENAME VALUE 'DANG_SAN_XUAT' TO 'IN_PRODUCTION';
ALTER TYPE "ProductionOrderStatus" RENAME VALUE 'HOAN_THANH' TO 'PRODUCTION_COMPLETED';
ALTER TYPE "ProductionOrderStatus" RENAME VALUE 'DA_HUY' TO 'CANCELLED';

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID');

-- AlterTable: MaterialPrice — add supplierName
ALTER TABLE "material_prices" ADD COLUMN "supplier_name" TEXT;

-- AlterTable: SalesOrder — add new fields
ALTER TABLE "sales_orders" ADD COLUMN "planned_cost" DECIMAL(15,0);
ALTER TABLE "sales_orders" ADD COLUMN "planned_profit" DECIMAL(15,0);
ALTER TABLE "sales_orders" ADD COLUMN "owner_name" TEXT;
ALTER TABLE "sales_orders" ADD COLUMN "total_production_orders" INTEGER;
ALTER TABLE "sales_orders" ADD COLUMN "completed_production_orders" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "sales_orders" ADD COLUMN "expected_delivery_date" TIMESTAMP(3);
ALTER TABLE "sales_orders" ADD COLUMN "actual_delivery_date" TIMESTAMP(3);
ALTER TABLE "sales_orders" ADD COLUMN "payment_status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID';

-- Backfill existing rows (dev data) so new required columns can be made NOT NULL
UPDATE "sales_orders" SET
  "planned_cost" = 0,
  "planned_profit" = "total_amount",
  "total_production_orders" = (
    SELECT COUNT(*) FROM "production_orders" WHERE "production_orders"."sales_order_id" = "sales_orders"."id"
  )
WHERE "planned_cost" IS NULL;

ALTER TABLE "sales_orders" ALTER COLUMN "planned_cost" SET NOT NULL;
ALTER TABLE "sales_orders" ALTER COLUMN "planned_profit" SET NOT NULL;
ALTER TABLE "sales_orders" ALTER COLUMN "total_production_orders" SET NOT NULL;

-- CreateIndex
CREATE INDEX "sales_orders_payment_status_idx" ON "sales_orders"("payment_status");
