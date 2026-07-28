-- CreateEnum
CREATE TYPE "QuotationItemType" AS ENUM ('PRODUCT', 'MATERIAL');

-- DropForeignKey
ALTER TABLE "quotation_items" DROP CONSTRAINT "quotation_items_product_id_fkey";

-- AlterTable
ALTER TABLE "materials" ADD COLUMN     "is_retailable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "retail_conversion_factor" DECIMAL(15,6),
ADD COLUMN     "retail_unit_id" TEXT,
ADD COLUMN     "retail_vat_rate" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "quotation_items" ADD COLUMN     "item_type" "QuotationItemType" NOT NULL DEFAULT 'PRODUCT',
ADD COLUMN     "material_code" TEXT,
ADD COLUMN     "material_id" TEXT,
ADD COLUMN     "material_name" TEXT,
ADD COLUMN     "material_unit" TEXT,
ALTER COLUMN "product_id" DROP NOT NULL,
ALTER COLUMN "product_code" DROP NOT NULL,
ALTER COLUMN "product_name" DROP NOT NULL;

-- AlterTable
ALTER TABLE "sales_order_items" ADD COLUMN     "item_type" "QuotationItemType" NOT NULL DEFAULT 'PRODUCT',
ADD COLUMN     "material_code" TEXT,
ADD COLUMN     "material_id" TEXT,
ADD COLUMN     "material_name" TEXT,
ADD COLUMN     "material_unit" TEXT,
ALTER COLUMN "product_id" DROP NOT NULL,
ALTER COLUMN "product_code" DROP NOT NULL,
ALTER COLUMN "product_name" DROP NOT NULL,
ALTER COLUMN "production_center_id" DROP NOT NULL,
ALTER COLUMN "production_center_name" DROP NOT NULL,
ALTER COLUMN "product_type_id" DROP NOT NULL,
ALTER COLUMN "product_type_name" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "materials_is_retailable_idx" ON "materials"("is_retailable");

-- CreateIndex
CREATE INDEX "quotation_items_material_id_idx" ON "quotation_items"("material_id");

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_retail_unit_id_fkey" FOREIGN KEY ("retail_unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;
