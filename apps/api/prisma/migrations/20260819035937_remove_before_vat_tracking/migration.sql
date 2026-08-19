-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_vat_settlement_id_fkey";

-- DropForeignKey
ALTER TABLE "vat_settlement_item_line_parameters" DROP CONSTRAINT "vat_settlement_item_line_parameters_vat_settlement_item_li_fkey";

-- DropForeignKey
ALTER TABLE "vat_settlement_item_lines" DROP CONSTRAINT "vat_settlement_item_lines_product_id_fkey";

-- DropForeignKey
ALTER TABLE "vat_settlement_item_lines" DROP CONSTRAINT "vat_settlement_item_lines_vat_settlement_item_id_fkey";

-- DropForeignKey
ALTER TABLE "vat_settlement_items" DROP CONSTRAINT "vat_settlement_items_opening_balance_id_fkey";

-- DropForeignKey
ALTER TABLE "vat_settlement_items" DROP CONSTRAINT "vat_settlement_items_receivable_id_fkey";

-- DropForeignKey
ALTER TABLE "vat_settlement_items" DROP CONSTRAINT "vat_settlement_items_vat_settlement_id_fkey";

-- DropForeignKey
ALTER TABLE "vat_settlement_timelines" DROP CONSTRAINT "vat_settlement_timelines_created_by_fkey";

-- DropForeignKey
ALTER TABLE "vat_settlement_timelines" DROP CONSTRAINT "vat_settlement_timelines_vat_settlement_id_fkey";

-- DropIndex
DROP INDEX "payments_vat_settlement_id_key";

-- AlterTable
ALTER TABLE "opening_balances" DROP COLUMN "amount_before_vat",
DROP COLUMN "remaining_amount_before_vat";

-- AlterTable
ALTER TABLE "payment_allocations" DROP COLUMN "allocated_subtotal",
DROP COLUMN "allocated_vat";

-- AlterTable
ALTER TABLE "payments" DROP COLUMN "vat_settlement_id";

-- AlterTable
ALTER TABLE "receivables" DROP COLUMN "closed_without_vat",
DROP COLUMN "remaining_amount_before_vat",
DROP COLUMN "total_amount_before_vat";

-- DropTable
DROP TABLE "vat_settlement_item_line_parameters";

-- DropTable
DROP TABLE "vat_settlement_item_lines";

-- DropTable
DROP TABLE "vat_settlement_items";

-- DropTable
DROP TABLE "vat_settlement_timelines";

-- DropTable
DROP TABLE "vat_settlements";

-- DropEnum
DROP TYPE "VatSettlementStatus";

-- DropEnum
DROP TYPE "VatSettlementTimelineAction";

-- DropEnum
DROP TYPE "VatSettlementTimelineActorType";

