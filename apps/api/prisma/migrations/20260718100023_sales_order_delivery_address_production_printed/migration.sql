-- AlterEnum
ALTER TYPE "ProductionOrderTimelineAction" ADD VALUE 'PRINTED';

-- AlterEnum
ALTER TYPE "SalesOrderTimelineAction" ADD VALUE 'DELIVERY_ADDRESS_UPDATED';

-- AlterTable
ALTER TABLE "sales_orders" ADD COLUMN     "delivery_address" TEXT,
ADD COLUMN     "delivery_district" TEXT,
ADD COLUMN     "delivery_name" TEXT,
ADD COLUMN     "delivery_phone" TEXT,
ADD COLUMN     "delivery_province" TEXT,
ADD COLUMN     "delivery_ward" TEXT;

-- Backfill: đơn hàng hiện có chưa có địa chỉ giao hàng riêng — dùng đúng
-- customer_name/customer_phone đã snapshot sẵn làm giá trị khởi tạo (không
-- có địa chỉ chi tiết trong quá khứ để backfill deliveryAddress/Province/
-- District/Ward, để NULL — đúng bản chất "chưa từng nhập").
UPDATE "sales_orders" SET "delivery_name" = "customer_name", "delivery_phone" = "customer_phone";

-- AlterTable: giờ toàn bộ hàng đã có giá trị — khoá NOT NULL cho 2 cột bắt buộc.
ALTER TABLE "sales_orders" ALTER COLUMN "delivery_name" SET NOT NULL,
ALTER COLUMN "delivery_phone" SET NOT NULL;
