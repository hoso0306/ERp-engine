-- AlterTable
ALTER TABLE "pricing_rule_versions" ADD COLUMN     "surcharge_expression" TEXT;

-- AlterTable
ALTER TABLE "quotation_items" ADD COLUMN     "surcharge_after_discount" DECIMAL(15,0) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "sales_order_items" ADD COLUMN     "surcharge_after_discount" DECIMAL(15,0) NOT NULL DEFAULT 0;
