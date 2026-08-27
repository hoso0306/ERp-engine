-- AlterEnum
ALTER TYPE "SalesOrderTimelineAction" ADD VALUE 'DEBT_MANUAL_ADJUSTED';

-- AlterTable
ALTER TABLE "returns" ADD COLUMN     "company_borne_reason" TEXT,
ADD COLUMN     "customer_borne_amount" DECIMAL(15,0) NOT NULL DEFAULT 0,
ADD COLUMN     "owner_id" TEXT,
ADD COLUMN     "owner_name" TEXT;
