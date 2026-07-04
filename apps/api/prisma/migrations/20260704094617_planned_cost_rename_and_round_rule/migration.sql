-- RenameColumn (preserve existing data — keep naming consistent with SalesOrder.plannedCost/plannedProfit)
ALTER TABLE "sales_order_items" RENAME COLUMN "plan_cost" TO "planned_cost";
ALTER TABLE "order_boms" RENAME COLUMN "plan_cost" TO "planned_cost";

-- AlterTable: OrderBOMItem — snapshot the Material Round Rule used to compute quantity
ALTER TABLE "order_bom_items" ADD COLUMN "round_type" "RoundType" NOT NULL DEFAULT 'NONE';
ALTER TABLE "order_bom_items" ADD COLUMN "round_value" DECIMAL(15,4);
