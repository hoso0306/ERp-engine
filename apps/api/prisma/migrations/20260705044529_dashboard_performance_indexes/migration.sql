-- CreateIndex
CREATE INDEX "receivables_due_date_idx" ON "receivables"("due_date");

-- CreateIndex
CREATE INDEX "sales_orders_expected_delivery_date_idx" ON "sales_orders"("expected_delivery_date");

-- CreateIndex
CREATE INDEX "warehouse_transactions_transaction_type_direction_created_a_idx" ON "warehouse_transactions"("transaction_type", "direction", "created_at");
