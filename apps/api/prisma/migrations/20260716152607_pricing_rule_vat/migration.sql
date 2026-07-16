-- AlterTable
ALTER TABLE "pricing_rule_versions" ADD COLUMN     "vat_rate" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "quotation_items" ADD COLUMN     "vat_amount" DECIMAL(15,0) NOT NULL DEFAULT 0,
ADD COLUMN     "vat_rate" DECIMAL(5,2) NOT NULL DEFAULT 0;
