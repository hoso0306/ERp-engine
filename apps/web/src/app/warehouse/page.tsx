"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader, Loading, ErrorState, EmptyState } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Search } from "lucide-react";
import { StockTable } from "@/components/warehouse/stock-table";
import { MaterialReceiptTable } from "@/components/warehouse/material-receipt-table";
import { MaterialReceiptDialog } from "@/components/warehouse/material-receipt-dialog";
import { TransactionTable } from "@/components/warehouse/transaction-table";
import { MaterialTypeahead, type MaterialOption } from "@/components/warehouse/material-typeahead";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

interface MaterialStockRow {
  id: string;
  code: string;
  name: string;
  currentStock: number;
  minimumStock: number | null;
  isActive: boolean;
  unit: { id: string; name: string } | null;
}

interface MaterialReceiptItemRow {
  id: string;
  materialCode: string;
  materialName: string;
  unit: string;
  quantity: number;
}

interface MaterialReceiptRow {
  id: string;
  code: string;
  items: MaterialReceiptItemRow[];
  supplierName: string | null;
  createdAt: string;
}

interface WarehouseTransactionRow {
  id: string;
  direction: string;
  transactionType: string;
  materialCode: string;
  materialName: string;
  unit: string;
  quantity: number;
  materialReceiptId: string | null;
  productionOrderId: string | null;
  createdAt: string;
}

export default function WarehousePage() {
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState("stock");

  const [receipts, setReceipts] = useState<MaterialReceiptRow[]>([]);
  const [receiptMeta, setReceiptMeta] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [receiptSearch, setReceiptSearch] = useState("");
  const [receiptPage, setReceiptPage] = useState(1);
  const [receiptLoading, setReceiptLoading] = useState(true);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);

  const [transactions, setTransactions] = useState<WarehouseTransactionRow[]>([]);
  const [transactionMeta, setTransactionMeta] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [transactionMaterial, setTransactionMaterial] = useState<MaterialOption | null>(null);
  const [transactionType, setTransactionType] = useState("all");
  const [transactionPage, setTransactionPage] = useState(1);
  const [transactionLoading, setTransactionLoading] = useState(true);
  const [transactionError, setTransactionError] = useState<string | null>(null);

  const [stock, setStock] = useState<MaterialStockRow[]>([]);
  const [stockMeta, setStockMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [stockSearch, setStockSearch] = useState("");
  const [stockPage, setStockPage] = useState(1);
  const [stockLoading, setStockLoading] = useState(true);
  const [stockError, setStockError] = useState<string | null>(null);

  const fetchStock = useCallback(async () => {
    setStockLoading(true);
    setStockError(null);
    try {
      const params = new URLSearchParams();
      if (stockSearch) params.set("search", stockSearch);
      params.set("page", String(stockPage));
      params.set("limit", "20");
      const json = await apiGet<{ data: MaterialStockRow[]; meta: typeof stockMeta }>(`/warehouse/stock?${params}`);
      setStock(json.data);
      setStockMeta(json.meta);
    } catch {
      setStockError("Không thể tải tồn kho.");
    } finally {
      setStockLoading(false);
    }
  }, [stockSearch, stockPage]);

  useEffect(() => {
    const timer = setTimeout(fetchStock, stockSearch ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchStock, stockSearch]);

  useEffect(() => {
    setStockPage(1);
  }, [stockSearch]);

  const fetchReceipts = useCallback(async () => {
    setReceiptLoading(true);
    setReceiptError(null);
    try {
      const params = new URLSearchParams();
      if (receiptSearch) params.set("search", receiptSearch);
      params.set("page", String(receiptPage));
      params.set("limit", "10");
      const json = await apiGet<{ data: MaterialReceiptRow[]; meta: typeof receiptMeta }>(`/material-receipts?${params}`);
      setReceipts(json.data);
      setReceiptMeta(json.meta);
    } catch {
      setReceiptError("Không thể tải danh sách phiếu nhập.");
    } finally {
      setReceiptLoading(false);
    }
  }, [receiptSearch, receiptPage]);

  useEffect(() => {
    if (tab !== "receipts") return;
    const timer = setTimeout(fetchReceipts, receiptSearch ? 300 : 0);
    return () => clearTimeout(timer);
  }, [tab, fetchReceipts, receiptSearch]);

  useEffect(() => {
    setReceiptPage(1);
  }, [receiptSearch]);

  const fetchTransactions = useCallback(async () => {
    setTransactionLoading(true);
    setTransactionError(null);
    try {
      const params = new URLSearchParams();
      if (transactionMaterial) params.set("materialId", transactionMaterial.id);
      if (transactionType !== "all") params.set("transactionType", transactionType);
      params.set("page", String(transactionPage));
      params.set("limit", "10");
      const json = await apiGet<{ data: WarehouseTransactionRow[]; meta: typeof transactionMeta }>(`/warehouse/transactions?${params}`);
      setTransactions(json.data);
      setTransactionMeta(json.meta);
    } catch {
      setTransactionError("Không thể tải lịch sử giao dịch kho.");
    } finally {
      setTransactionLoading(false);
    }
  }, [transactionMaterial, transactionType, transactionPage]);

  useEffect(() => {
    if (tab !== "transactions") return;
    fetchTransactions();
  }, [tab, fetchTransactions]);

  useEffect(() => {
    setTransactionPage(1);
  }, [transactionMaterial, transactionType]);

  return (
    <div className="space-y-6">
      <PageHeader title="Kho" description="Tồn kho nguyên liệu, phiếu nhập và lịch sử giao dịch" />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="stock">Tồn kho</TabsTrigger>
          <TabsTrigger value="receipts">Phiếu nhập vật tư</TabsTrigger>
          <TabsTrigger value="transactions">Lịch sử giao dịch</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="space-y-4 mt-4">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Tìm theo mã, tên vật tư..."
              value={stockSearch}
              onChange={(e) => setStockSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {stockLoading && <Loading />}
          {stockError && <ErrorState description={stockError} onRetry={fetchStock} />}
          {!stockLoading && !stockError && stock.length === 0 && (
            <EmptyState title="Không có vật tư" description="Không có vật tư nào khớp tìm kiếm." />
          )}
          {!stockLoading && !stockError && stock.length > 0 && (
            <StockTable materials={stock} meta={stockMeta} onPageChange={setStockPage} />
          )}
        </TabsContent>

        <TabsContent value="receipts" className="space-y-4 mt-4">
          <div className="flex gap-3 items-center justify-between flex-wrap">
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Tìm theo mã phiếu, vật tư..."
                value={receiptSearch}
                onChange={(e) => setReceiptSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {hasPermission("warehouse.receipt") && (
              <Button onClick={() => setReceiptDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Tạo phiếu nhập
              </Button>
            )}
          </div>

          {receiptLoading && <Loading />}
          {receiptError && <ErrorState description={receiptError} onRetry={fetchReceipts} />}
          {!receiptLoading && !receiptError && receipts.length === 0 && (
            <EmptyState title="Chưa có phiếu nhập" description="Tạo phiếu nhập đầu tiên để bắt đầu." />
          )}
          {!receiptLoading && !receiptError && receipts.length > 0 && (
            <MaterialReceiptTable receipts={receipts} meta={receiptMeta} onPageChange={setReceiptPage} />
          )}
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4 mt-4">
          <div className="flex gap-3 flex-wrap items-end">
            <div className="w-72">
              <MaterialTypeahead value={transactionMaterial} onChange={setTransactionMaterial} />
            </div>
            <Select value={transactionType} onValueChange={(v) => setTransactionType(v ?? "all")}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Loại giao dịch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả loại</SelectItem>
                <SelectItem value="MATERIAL_RECEIPT">Nhập kho</SelectItem>
                <SelectItem value="MATERIAL_ISSUE">Xuất sản xuất</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {transactionLoading && <Loading />}
          {transactionError && <ErrorState description={transactionError} onRetry={fetchTransactions} />}
          {!transactionLoading && !transactionError && transactions.length === 0 && (
            <EmptyState title="Không có giao dịch" description="Không có giao dịch kho nào khớp bộ lọc." />
          )}
          {!transactionLoading && !transactionError && transactions.length > 0 && (
            <TransactionTable transactions={transactions} meta={transactionMeta} onPageChange={setTransactionPage} />
          )}
        </TabsContent>
      </Tabs>

      <MaterialReceiptDialog
        open={receiptDialogOpen}
        onOpenChange={setReceiptDialogOpen}
        onSaved={() => {
          fetchReceipts();
          fetchStock();
        }}
      />
    </div>
  );
}
