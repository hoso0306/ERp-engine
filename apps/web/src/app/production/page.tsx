"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { PageHeader, Loading, ErrorState, EmptyState, todayISO, endOfDayBound } from "@/components/shared";
import {
  ProductionFilter,
  TAB_STATUS_PARAM,
  type ProductionOrderTab,
} from "@/components/production/production-filter";
import { ProductionTable } from "@/components/production/production-table";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import { apiGet } from "@/lib/api";

interface ProductionOrderRow {
  id: string;
  code: string;
  productionCenterName: string;
  status: string;
  salesOrder: { id: string; code: string; customerName: string };
  _count: { items: number };
  isPrinted: boolean;
  createdAt: string;
  completedAt: string | null;
}

interface ProductionCenter {
  id: string;
  code: string;
  name: string;
}

export default function ProductionPage() {
  const [orders, setOrders] = useState<ProductionOrderRow[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [productionCenters, setProductionCenters] = useState<ProductionCenter[]>([]);
  const [search, setSearch] = useState("");
  // Mặc định "Tất cả" + Ngày tạo "Hôm nay" (rà soát bộ lọc, chốt 18/07/2026) —
  // cùng thiết kế với Đơn hàng.
  const [tab, setTab] = useState<ProductionOrderTab>("all");
  const [productionCenterId, setProductionCenterId] = useState("all");
  const [dateFrom, setDateFrom] = useState(todayISO());
  const [dateTo, setDateTo] = useState(todayISO());
  const [completedFrom, setCompletedFrom] = useState("");
  const [completedTo, setCompletedTo] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // In hàng loạt (009-in-phieu-san-xuat.md Việc 6).
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const statusParam = TAB_STATUS_PARAM[tab];
      if (statusParam) params.set("status", statusParam);
      if (productionCenterId !== "all") params.set("productionCenterId", productionCenterId);
      params.set("page", String(page));
      params.set("limit", "10");

      const json = await apiGet<{ data: ProductionOrderRow[]; meta: typeof meta }>(`/production-orders?${params}`);
      setOrders(json.data);
      setMeta(json.meta);
    } catch {
      setError("Không thể tải danh sách phiếu sản xuất.");
    } finally {
      setLoading(false);
    }
  }, [search, tab, productionCenterId, page]);

  useEffect(() => {
    apiGet<ProductionCenter[]>("/production-centers").then(setProductionCenters).catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(fetchOrders, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchOrders, search]);

  useEffect(() => {
    setPage(1);
  }, [search, tab, productionCenterId]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll(ids: string[]) {
    setSelectedIds((prev) => {
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      }
      return new Set([...prev, ...ids]);
    });
  }

  // BE chưa hỗ trợ filter theo ngày (ProductionOrderQueryDto không có field
  // này) — lọc phía FE trên trang dữ liệu hiện tại, cùng pattern Đơn hàng.
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (dateFrom || dateTo) {
        const d = new Date(o.createdAt);
        if (dateFrom && d < new Date(dateFrom)) return false;
        if (dateTo && d > endOfDayBound(dateTo)) return false;
      }
      if (completedFrom || completedTo) {
        if (!o.completedAt) return false;
        const d = new Date(o.completedAt);
        if (completedFrom && d < new Date(completedFrom)) return false;
        if (completedTo && d > endOfDayBound(completedTo)) return false;
      }
      return true;
    });
  }, [orders, dateFrom, dateTo, completedFrom, completedTo]);

  return (
    <div className="space-y-6">
      <PageHeader title="Sản xuất" description="Theo dõi và thao tác Phiếu sản xuất của các xưởng" />

      <ProductionFilter
        search={search}
        onSearchChange={setSearch}
        tab={tab}
        onTabChange={setTab}
        productionCenters={productionCenters}
        productionCenterId={productionCenterId}
        onProductionCenterChange={(v) => setProductionCenterId(v ?? "all")}
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
        completedFrom={completedFrom}
        onCompletedFromChange={setCompletedFrom}
        completedTo={completedTo}
        onCompletedToChange={setCompletedTo}
      />

      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-md border bg-muted/40 px-4 py-2">
          <span className="text-sm">Đã chọn {selectedIds.size} phiếu</span>
          <a href={`/production/print?ids=${Array.from(selectedIds).join(",")}`} target="_blank" rel="noreferrer">
            <Button size="sm">
              <FileDown className="mr-2 h-4 w-4" />
              In đã chọn ({selectedIds.size})
            </Button>
          </a>
        </div>
      )}

      {loading && <Loading />}
      {error && <ErrorState description={error} onRetry={fetchOrders} />}
      {!loading && !error && filteredOrders.length === 0 && (
        <EmptyState title="Không có phiếu sản xuất" description="Không có phiếu nào khớp bộ lọc." />
      )}
      {!loading && !error && filteredOrders.length > 0 && (
        <ProductionTable
          orders={filteredOrders}
          meta={meta}
          onPageChange={setPage}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
        />
      )}
    </div>
  );
}
