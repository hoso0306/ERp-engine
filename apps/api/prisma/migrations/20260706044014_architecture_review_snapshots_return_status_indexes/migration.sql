-- Architecture Review 05/07/2026 (erd.md mục 19) — một đợt migration duy nhất:
-- snapshot mới (QuotationItem, SalesOrderItem), ReturnStatus, SalesOrder.ownerId
-- và các index phục vụ Báo cáo.
--
-- Các khối UPDATE bên dưới là BACKFILL MỘT LẦN cho dữ liệu có sẵn tại thời điểm
-- migrate — KHÔNG phải logic runtime. Runtime do API thêm/sửa dòng báo giá và
-- Quotation.approve() snapshot trong transaction (xem quotation.md/report.md).

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('PROCESSING', 'COMPLETED');

-- ──────────────────────────────────────────────────────────────────────
-- QuotationItem: snapshot product_code/product_name
-- Thêm nullable → backfill join product_id → products → SET NOT NULL.
-- ──────────────────────────────────────────────────────────────────────
ALTER TABLE "quotation_items" ADD COLUMN "product_code" TEXT,
ADD COLUMN "product_name" TEXT;

-- Backfill một lần: bản ghi cũ chưa có snapshot, lấy theo Product hiện tại
-- (chấp nhận — không còn nguồn nào khác cho dữ liệu lịch sử).
UPDATE "quotation_items" qi
SET "product_code" = p."code",
    "product_name" = p."name"
FROM "products" p
WHERE qi."product_id" = p."id";

ALTER TABLE "quotation_items" ALTER COLUMN "product_code" SET NOT NULL,
ALTER COLUMN "product_name" SET NOT NULL;

-- ──────────────────────────────────────────────────────────────────────
-- Return: trạng thái xử lý
-- Bản ghi có sẵn set COMPLETED — nghiệp vụ đã kết thúc trước khi có trạng thái.
-- Bản ghi mới nhận DEFAULT 'PROCESSING'.
-- ──────────────────────────────────────────────────────────────────────
ALTER TABLE "returns" ADD COLUMN "status" "ReturnStatus" NOT NULL DEFAULT 'PROCESSING';

UPDATE "returns" SET "status" = 'COMPLETED';

-- ──────────────────────────────────────────────────────────────────────
-- SalesOrderItem: product_type_id (Redundant Reference) + product_type_name
-- (snapshot) phục vụ Báo cáo B2/B4 (report.md).
-- Backfill join qua product_id sẵn có (chính xác hơn join theo product_code
-- như ghi trong erd.md mục 19 — cột product_id đã tồn tại từ trước).
-- ──────────────────────────────────────────────────────────────────────
ALTER TABLE "sales_order_items" ADD COLUMN "product_type_id" TEXT,
ADD COLUMN "product_type_name" TEXT;

UPDATE "sales_order_items" soi
SET "product_type_id"   = p."product_type_id",
    "product_type_name" = pt."name"
FROM "products" p
JOIN "product_types" pt ON pt."id" = p."product_type_id"
WHERE soi."product_id" = p."id";

ALTER TABLE "sales_order_items" ALTER COLUMN "product_type_id" SET NOT NULL,
ALTER COLUMN "product_type_name" SET NOT NULL;

-- ──────────────────────────────────────────────────────────────────────
-- SalesOrder: owner_id (FK users) — KHÔNG backfill, dữ liệu cũ không xác định
-- được người phụ trách nên để NULL (erd.md mục 19).
-- ──────────────────────────────────────────────────────────────────────
ALTER TABLE "sales_orders" ADD COLUMN "owner_id" TEXT;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ──────────────────────────────────────────────────────────────────────
-- Index phục vụ Báo cáo (report.md mục 3)
-- ──────────────────────────────────────────────────────────────────────

-- CreateIndex
CREATE INDEX "material_receipts_created_at_idx" ON "material_receipts"("created_at");

-- CreateIndex
CREATE INDEX "payments_payment_date_idx" ON "payments"("payment_date");

-- CreateIndex
CREATE INDEX "returns_return_date_idx" ON "returns"("return_date");

-- CreateIndex
CREATE INDEX "sales_order_items_product_id_idx" ON "sales_order_items"("product_id");

-- CreateIndex
CREATE INDEX "sales_order_items_product_type_id_idx" ON "sales_order_items"("product_type_id");

-- CreateIndex
CREATE INDEX "sales_orders_created_at_idx" ON "sales_orders"("created_at");
