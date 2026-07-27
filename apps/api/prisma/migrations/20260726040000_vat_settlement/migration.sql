-- CreateEnum
CREATE TYPE "VatSettlementTimelineActorType" AS ENUM ('SYSTEM', 'USER');

-- CreateEnum
CREATE TYPE "VatSettlementStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'INVOICED');

-- CreateEnum
CREATE TYPE "VatSettlementTimelineAction" AS ENUM ('VAT_SETTLEMENT_CREATED', 'VAT_SETTLEMENT_SENT', 'VAT_SETTLEMENT_PAID', 'VAT_SETTLEMENT_INVOICED');

-- AlterEnum
ALTER TYPE "SalesOrderTimelineAction" ADD VALUE 'VAT_SETTLEMENT_UPDATED';

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "vat_settlement_id" TEXT;

-- AlterTable
ALTER TABLE "receivables" ADD COLUMN     "closed_without_vat" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "vat_settlements" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "status" "VatSettlementStatus" NOT NULL DEFAULT 'DRAFT',
    "invoice_number" TEXT,
    "invoice_date" TIMESTAMP(3),
    "total_amount" DECIMAL(15,0) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "payment_id" TEXT,

    CONSTRAINT "vat_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vat_settlement_items" (
    "id" TEXT NOT NULL,
    "vat_settlement_id" TEXT NOT NULL,
    "receivable_id" TEXT NOT NULL,
    "amount" DECIMAL(15,0) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vat_settlement_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vat_settlement_timelines" (
    "id" TEXT NOT NULL,
    "vat_settlement_id" TEXT NOT NULL,
    "action" "VatSettlementTimelineAction" NOT NULL,
    "actor_type" "VatSettlementTimelineActorType" NOT NULL,
    "payload" JSONB,
    "created_by" TEXT,
    "created_by_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vat_settlement_timelines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vat_settlements_code_key" ON "vat_settlements"("code");

-- CreateIndex
CREATE INDEX "vat_settlements_customer_id_idx" ON "vat_settlements"("customer_id");

-- CreateIndex
CREATE INDEX "vat_settlement_items_vat_settlement_id_idx" ON "vat_settlement_items"("vat_settlement_id");

-- CreateIndex
CREATE INDEX "vat_settlement_items_receivable_id_idx" ON "vat_settlement_items"("receivable_id");

-- CreateIndex
CREATE INDEX "vat_settlement_timelines_vat_settlement_id_idx" ON "vat_settlement_timelines"("vat_settlement_id");

-- CreateIndex
CREATE INDEX "vat_settlement_timelines_vat_settlement_id_created_at_idx" ON "vat_settlement_timelines"("vat_settlement_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payments_vat_settlement_id_key" ON "payments"("vat_settlement_id");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_vat_settlement_id_fkey" FOREIGN KEY ("vat_settlement_id") REFERENCES "vat_settlements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vat_settlement_items" ADD CONSTRAINT "vat_settlement_items_vat_settlement_id_fkey" FOREIGN KEY ("vat_settlement_id") REFERENCES "vat_settlements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vat_settlement_items" ADD CONSTRAINT "vat_settlement_items_receivable_id_fkey" FOREIGN KEY ("receivable_id") REFERENCES "receivables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vat_settlement_timelines" ADD CONSTRAINT "vat_settlement_timelines_vat_settlement_id_fkey" FOREIGN KEY ("vat_settlement_id") REFERENCES "vat_settlements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vat_settlement_timelines" ADD CONSTRAINT "vat_settlement_timelines_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

