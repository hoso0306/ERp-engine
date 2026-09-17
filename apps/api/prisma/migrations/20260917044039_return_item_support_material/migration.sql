-- AlterTable
ALTER TABLE "recovery_inventories" ADD COLUMN     "item_type" "QuotationItemType" NOT NULL DEFAULT 'PRODUCT',
ADD COLUMN     "material_code" TEXT,
ADD COLUMN     "material_name" TEXT,
ADD COLUMN     "material_unit" TEXT,
ALTER COLUMN "product_code" DROP NOT NULL,
ALTER COLUMN "product_name" DROP NOT NULL;

-- AlterTable
ALTER TABLE "return_items" ADD COLUMN     "item_type" "QuotationItemType" NOT NULL DEFAULT 'PRODUCT',
ADD COLUMN     "material_code" TEXT,
ADD COLUMN     "material_name" TEXT,
ADD COLUMN     "material_unit" TEXT,
ALTER COLUMN "product_code" DROP NOT NULL,
ALTER COLUMN "product_name" DROP NOT NULL;
