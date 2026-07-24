-- Chiết khấu Khách hàng × Sản phẩm -> Khách hàng × Loại sản phẩm (chốt 24/07/2026)

-- AlterTable: add nullable product_type_id first, backfill, then enforce NOT NULL
ALTER TABLE "customer_product_discounts" ADD COLUMN "product_type_id" TEXT;

UPDATE "customer_product_discounts" d
SET "product_type_id" = p."product_type_id"
FROM "products" p
WHERE p."id" = d."product_id";

ALTER TABLE "customer_product_discounts" ALTER COLUMN "product_type_id" SET NOT NULL;

-- DropForeignKey
ALTER TABLE "customer_product_discounts" DROP CONSTRAINT "customer_product_discounts_product_id_fkey";

-- DropIndex
DROP INDEX "customer_product_discounts_customer_id_product_id_key";

-- AlterTable
ALTER TABLE "customer_product_discounts" DROP COLUMN "product_id";

-- CreateIndex
CREATE UNIQUE INDEX "customer_product_discounts_customer_id_product_type_id_key" ON "customer_product_discounts"("customer_id", "product_type_id");

-- AddForeignKey
ALTER TABLE "customer_product_discounts" ADD CONSTRAINT "customer_product_discounts_product_type_id_fkey" FOREIGN KEY ("product_type_id") REFERENCES "product_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
