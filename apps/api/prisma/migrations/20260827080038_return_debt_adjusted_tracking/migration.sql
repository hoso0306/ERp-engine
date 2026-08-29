-- AlterTable
ALTER TABLE "returns" ADD COLUMN     "debt_adjusted_amount" DECIMAL(15,0),
ADD COLUMN     "debt_adjusted_at" TIMESTAMP(3);
