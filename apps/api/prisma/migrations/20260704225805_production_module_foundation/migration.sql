-- CreateEnum
CREATE TYPE "ProductionOrderTimelineActorType" AS ENUM ('SYSTEM', 'USER');

-- CreateEnum
CREATE TYPE "ProductionOrderTimelineAction" AS ENUM ('PRODUCTION_ORDER_CREATED', 'STARTED', 'COMPLETED', 'CANCELLED');

-- AlterTable: ProductionOrder — add startedAt/completedAt
ALTER TABLE "production_orders" ADD COLUMN "started_at" TIMESTAMP(3);
ALTER TABLE "production_orders" ADD COLUMN "completed_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "production_order_timelines" (
    "id" TEXT NOT NULL,
    "production_order_id" TEXT NOT NULL,
    "action" "ProductionOrderTimelineAction" NOT NULL,
    "actor_type" "ProductionOrderTimelineActorType" NOT NULL,
    "payload" JSONB,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_order_timelines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "production_order_timelines_production_order_id_idx" ON "production_order_timelines"("production_order_id");
CREATE INDEX "production_order_timelines_production_order_id_created_at_idx" ON "production_order_timelines"("production_order_id", "created_at");

-- AddForeignKey
ALTER TABLE "production_order_timelines" ADD CONSTRAINT "production_order_timelines_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Running Number: rename prefix SX -> PO (Task 00 — production module, quy ước bỏ viết tắt tiếng Việt)
UPDATE "running_numbers" SET "prefix" = 'PO' WHERE "type" = 'PRODUCTION_ORDER' AND "prefix" = 'SX';
