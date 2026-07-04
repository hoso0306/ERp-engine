-- CreateEnum
CREATE TYPE "SalesOrderTimelineActorType" AS ENUM ('SYSTEM', 'USER');

-- CreateEnum
CREATE TYPE "SalesOrderTimelineAction" AS ENUM ('SALES_ORDER_CREATED', 'PRODUCTION_ORDERS_GENERATED', 'PRODUCTION_COMPLETED', 'SHIPPED', 'DELIVERED', 'PAYMENT_STATUS_CHANGED', 'MANUAL_OVERRIDE', 'CANCELLED');

-- CreateTable
CREATE TABLE "sales_order_timelines" (
    "id" TEXT NOT NULL,
    "sales_order_id" TEXT NOT NULL,
    "action" "SalesOrderTimelineAction" NOT NULL,
    "actor_type" "SalesOrderTimelineActorType" NOT NULL,
    "payload" JSONB,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_order_timelines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sales_order_timelines_sales_order_id_idx" ON "sales_order_timelines"("sales_order_id");

-- CreateIndex
CREATE INDEX "sales_order_timelines_sales_order_id_created_at_idx" ON "sales_order_timelines"("sales_order_id", "created_at");

-- AddForeignKey
ALTER TABLE "sales_order_timelines" ADD CONSTRAINT "sales_order_timelines_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
