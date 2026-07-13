-- CreateEnum
CREATE TYPE "ValidationSeverity" AS ENUM ('WARN', 'BLOCK');

-- AlterEnum
ALTER TYPE "PricingRuleType" ADD VALUE 'BILLABLE_STEP';

-- AlterTable
ALTER TABLE "material_requirement_items" ADD COLUMN     "condition" TEXT;

-- AlterTable
ALTER TABLE "pricing_rule_items" ADD COLUMN     "bill_value" DECIMAL(15,4),
ADD COLUMN     "condition" TEXT,
ADD COLUMN     "range_from" DECIMAL(15,4),
ADD COLUMN     "range_to" DECIMAL(15,4);

-- CreateTable
CREATE TABLE "price_matrix_rows" (
    "id" TEXT NOT NULL,
    "pricing_rule_version_id" TEXT NOT NULL,
    "dimensions" JSONB NOT NULL,
    "config_key" TEXT NOT NULL,
    "unit_price" DECIMAL(15,0) NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_matrix_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "validation_rules" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "expression" TEXT NOT NULL,
    "severity" "ValidationSeverity" NOT NULL DEFAULT 'WARN',
    "message" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "validation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "derived_parameters" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "expression" TEXT NOT NULL,
    "unit" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "derived_parameters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "price_matrix_rows_pricing_rule_version_id_idx" ON "price_matrix_rows"("pricing_rule_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "price_matrix_rows_pricing_rule_version_id_config_key_key" ON "price_matrix_rows"("pricing_rule_version_id", "config_key");

-- CreateIndex
CREATE INDEX "validation_rules_product_id_display_order_idx" ON "validation_rules"("product_id", "display_order");

-- CreateIndex
CREATE INDEX "derived_parameters_product_id_display_order_idx" ON "derived_parameters"("product_id", "display_order");

-- CreateIndex
CREATE UNIQUE INDEX "derived_parameters_product_id_name_key" ON "derived_parameters"("product_id", "name");

-- AddForeignKey
ALTER TABLE "price_matrix_rows" ADD CONSTRAINT "price_matrix_rows_pricing_rule_version_id_fkey" FOREIGN KEY ("pricing_rule_version_id") REFERENCES "pricing_rule_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_rules" ADD CONSTRAINT "validation_rules_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "derived_parameters" ADD CONSTRAINT "derived_parameters_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill MỘT LẦN (Sprint 03 Task 05 — không phải logic runtime):
-- seed DerivedParameter `area` (m², kích thước nhập cm) cho các sản phẩm
-- đã có đủ tham số chieurong + chieucao. Sản phẩm mới sẽ tự cấu hình qua UI.
INSERT INTO "derived_parameters" ("id", "product_id", "name", "expression", "unit", "display_order", "created_at", "updated_at")
SELECT gen_random_uuid()::text, p."id", 'area', 'chieurong * chieucao / 10000', 'm²', 0, NOW(), NOW()
FROM "products" p
WHERE EXISTS (SELECT 1 FROM "product_parameters" pp WHERE pp."product_id" = p."id" AND pp."name" = 'chieurong')
  AND EXISTS (SELECT 1 FROM "product_parameters" pp WHERE pp."product_id" = p."id" AND pp."name" = 'chieucao');
