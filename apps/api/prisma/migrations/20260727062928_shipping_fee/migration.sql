-- AlterTable
ALTER TABLE "quotations" ADD COLUMN     "shipping_fee" DECIMAL(15,0) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "sales_orders" ADD COLUMN     "shipping_fee" DECIMAL(15,0) NOT NULL DEFAULT 0;
