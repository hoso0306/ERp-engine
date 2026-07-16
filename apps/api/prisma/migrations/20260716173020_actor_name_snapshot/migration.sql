-- AlterTable
ALTER TABLE "material_receipts" ADD COLUMN     "created_by_name" TEXT;

-- AlterTable
ALTER TABLE "production_order_timelines" ADD COLUMN     "created_by_name" TEXT;

-- AlterTable
ALTER TABLE "quotation_items" ADD COLUMN     "discount_by_name" TEXT;

-- AlterTable
ALTER TABLE "quotation_timelines" ADD COLUMN     "created_by_name" TEXT;

-- AlterTable
ALTER TABLE "returns" ADD COLUMN     "completed_by_name" TEXT;

-- AlterTable
ALTER TABLE "sales_order_timelines" ADD COLUMN     "created_by_name" TEXT;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_discount_by_fkey" FOREIGN KEY ("discount_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_timelines" ADD CONSTRAINT "quotation_timelines_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_timelines" ADD CONSTRAINT "sales_order_timelines_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_order_timelines" ADD CONSTRAINT "production_order_timelines_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_receipts" ADD CONSTRAINT "material_receipts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
