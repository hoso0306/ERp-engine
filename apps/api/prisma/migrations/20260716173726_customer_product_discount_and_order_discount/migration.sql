-- DropForeignKey
ALTER TABLE "quotation_items" DROP CONSTRAINT "quotation_items_discount_by_fkey";

-- AlterTable
ALTER TABLE "customer_groups" DROP COLUMN "discount_percent";

-- AlterTable
ALTER TABLE "customers" DROP COLUMN "default_discount";

-- AlterTable
ALTER TABLE "quotation_items" DROP COLUMN "additional_discount_amount",
DROP COLUMN "additional_discount_percent",
DROP COLUMN "discount_by",
DROP COLUMN "discount_by_name",
DROP COLUMN "discount_reason",
DROP COLUMN "group_discount",
ADD COLUMN     "discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "note" TEXT;

-- AlterTable
ALTER TABLE "quotations" ADD COLUMN     "discount_amount" DECIMAL(15,0) NOT NULL DEFAULT 0,
ADD COLUMN     "discount_by" TEXT,
ADD COLUMN     "discount_reason" TEXT;

-- AlterTable
ALTER TABLE "sales_order_items" DROP COLUMN "additional_discount_amount",
DROP COLUMN "additional_discount_percent",
DROP COLUMN "group_discount",
ADD COLUMN     "discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "vat_amount" DECIMAL(15,0) NOT NULL DEFAULT 0,
ADD COLUMN     "vat_rate" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "sales_orders" ADD COLUMN     "discount_amount" DECIMAL(15,0) NOT NULL DEFAULT 0,
ADD COLUMN     "discount_by" TEXT,
ADD COLUMN     "discount_reason" TEXT,
ADD COLUMN     "grand_total" DECIMAL(15,0) NOT NULL DEFAULT 0,
ADD COLUMN     "total_vat_amount" DECIMAL(15,0) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "customer_product_discounts" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "discount_percent" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_product_discounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_product_discounts_customer_id_product_id_key" ON "customer_product_discounts"("customer_id", "product_id");

-- AddForeignKey
ALTER TABLE "customer_product_discounts" ADD CONSTRAINT "customer_product_discounts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_product_discounts" ADD CONSTRAINT "customer_product_discounts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

