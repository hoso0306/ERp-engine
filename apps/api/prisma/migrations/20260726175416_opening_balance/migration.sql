-- CreateEnum
CREATE TYPE "OpeningBalanceTimelineActorType" AS ENUM ('SYSTEM', 'USER');

-- CreateEnum
CREATE TYPE "OpeningBalanceTimelineAction" AS ENUM ('OPENING_BALANCE_CREATED', 'OPENING_BALANCE_REDUCED');

-- DropForeignKey
ALTER TABLE "vat_settlement_items" DROP CONSTRAINT "vat_settlement_items_receivable_id_fkey";

-- AlterTable
ALTER TABLE "vat_settlement_items" ADD COLUMN     "opening_balance_id" TEXT,
ALTER COLUMN "receivable_id" DROP NOT NULL;

-- Đúng 1 trong 2 nguồn (Receivable / OpeningBalance) phải có giá trị — thêm
-- tay (Prisma không tự sinh CHECK đa cột), cùng convention
-- receivables_remaining_amount_check.
ALTER TABLE "vat_settlement_items" ADD CONSTRAINT "vat_settlement_items_source_check" CHECK (num_nonnulls("receivable_id", "opening_balance_id") = 1);

-- CreateTable
CREATE TABLE "vat_settlement_item_lines" (
    "id" TEXT NOT NULL,
    "vat_settlement_item_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "product_code" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "quantity" DECIMAL(15,4) NOT NULL,
    "pricing_rule_version_id" TEXT,
    "system_price" DECIMAL(15,0) NOT NULL DEFAULT 0,
    "discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "surcharge_after_discount" DECIMAL(15,0) NOT NULL DEFAULT 0,
    "final_price" DECIMAL(15,0) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(15,0) NOT NULL DEFAULT 0,
    "vat_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "vat_amount" DECIMAL(15,0) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vat_settlement_item_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vat_settlement_item_line_parameters" (
    "id" TEXT NOT NULL,
    "vat_settlement_item_line_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "value_label" TEXT,
    "unit" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "vat_settlement_item_line_parameters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opening_balances" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "amount_before_vat" DECIMAL(15,0) NOT NULL,
    "amount" DECIMAL(15,0) NOT NULL,
    "remaining_amount_before_vat" DECIMAL(15,0) NOT NULL,
    "remaining_amount" DECIMAL(15,0) NOT NULL,
    "note" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opening_balances_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "opening_balances_remaining_amount_check" CHECK ("remaining_amount" >= 0),
    CONSTRAINT "opening_balances_remaining_amount_before_vat_check" CHECK ("remaining_amount_before_vat" >= 0)
);

-- CreateTable
CREATE TABLE "opening_balance_timelines" (
    "id" TEXT NOT NULL,
    "opening_balance_id" TEXT NOT NULL,
    "action" "OpeningBalanceTimelineAction" NOT NULL,
    "actor_type" "OpeningBalanceTimelineActorType" NOT NULL,
    "payload" JSONB,
    "created_by" TEXT,
    "created_by_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opening_balance_timelines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vat_settlement_item_lines_vat_settlement_item_id_idx" ON "vat_settlement_item_lines"("vat_settlement_item_id");

-- CreateIndex
CREATE INDEX "vat_settlement_item_line_parameters_vat_settlement_item_lin_idx" ON "vat_settlement_item_line_parameters"("vat_settlement_item_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "opening_balances_code_key" ON "opening_balances"("code");

-- CreateIndex
CREATE INDEX "opening_balances_customer_id_idx" ON "opening_balances"("customer_id");

-- CreateIndex
CREATE INDEX "opening_balance_timelines_opening_balance_id_idx" ON "opening_balance_timelines"("opening_balance_id");

-- CreateIndex
CREATE INDEX "opening_balance_timelines_opening_balance_id_created_at_idx" ON "opening_balance_timelines"("opening_balance_id", "created_at");

-- CreateIndex
CREATE INDEX "vat_settlement_items_opening_balance_id_idx" ON "vat_settlement_items"("opening_balance_id");

-- AddForeignKey
ALTER TABLE "vat_settlement_items" ADD CONSTRAINT "vat_settlement_items_receivable_id_fkey" FOREIGN KEY ("receivable_id") REFERENCES "receivables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vat_settlement_items" ADD CONSTRAINT "vat_settlement_items_opening_balance_id_fkey" FOREIGN KEY ("opening_balance_id") REFERENCES "opening_balances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vat_settlement_item_lines" ADD CONSTRAINT "vat_settlement_item_lines_vat_settlement_item_id_fkey" FOREIGN KEY ("vat_settlement_item_id") REFERENCES "vat_settlement_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vat_settlement_item_lines" ADD CONSTRAINT "vat_settlement_item_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vat_settlement_item_line_parameters" ADD CONSTRAINT "vat_settlement_item_line_parameters_vat_settlement_item_li_fkey" FOREIGN KEY ("vat_settlement_item_line_id") REFERENCES "vat_settlement_item_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opening_balance_timelines" ADD CONSTRAINT "opening_balance_timelines_opening_balance_id_fkey" FOREIGN KEY ("opening_balance_id") REFERENCES "opening_balances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opening_balance_timelines" ADD CONSTRAINT "opening_balance_timelines_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
