-- AlterTable
ALTER TABLE "receivables" ADD COLUMN     "total_amount_before_vat" DECIMAL(15,0) NOT NULL DEFAULT 0;
ALTER TABLE "receivables" ADD COLUMN     "remaining_amount_before_vat" DECIMAL(15,0) NOT NULL DEFAULT 0;
