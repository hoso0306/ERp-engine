-- AlterEnum
ALTER TYPE "SalesOrderTimelineAction" ADD VALUE 'CARRIER_INFO_UPDATED';

-- AlterTable
ALTER TABLE "sales_orders" ADD COLUMN     "carrier_name" TEXT,
ADD COLUMN     "carrier_note" TEXT,
ADD COLUMN     "carrier_phone" TEXT;
