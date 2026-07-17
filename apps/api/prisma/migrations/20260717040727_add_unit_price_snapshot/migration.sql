-- AlterTable
ALTER TABLE "quotation_items" ADD COLUMN     "unit_price" DECIMAL(15,0);

-- AlterTable
ALTER TABLE "sales_order_items" ADD COLUMN     "unit_price" DECIMAL(15,0);
