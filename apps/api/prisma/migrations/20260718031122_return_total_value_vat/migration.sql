-- AlterTable
ALTER TABLE "return_items" ADD COLUMN     "vat_rate" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "returns" ADD COLUMN     "total_value" DECIMAL(15,0) NOT NULL DEFAULT 0;

