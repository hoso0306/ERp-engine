"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader, Loading, ErrorState, EmptyState } from "@/components/shared";
import {
  ProductionFilter,
  TAB_STATUS_PARAM,
  type ProductionOrderTab,
} from "@/components/production/production-filter";
import { ProductionTable } from "@/components/production/production-table";
import { apiGet } from "@/lib/api";

interface ProductionOrderRow {
  id: string;
  code: string;
  productionCenterName: string;
  status: string;
  salesOrder: { id: string; code: string; customerName: string };
  _count: { items: number };
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
  // Mặc định "Chờ SX" — nhóm phiếu cần thao tác nhiều nhất.
  const [tab, setTab] = useState<ProductionOrderTab>("pending");
  const [productionCenterId, setProductionCenterId] = useState("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      />

      {loading && <Loading />}
      {error && <ErrorState description={error} onRetry={fetchOrders} />}
      {!loading && !error && orders.length === 0 && (
        <EmptyState title="Không có phiếu sản xuất" description="Không có phiếu nào khớp bộ lọc." />
      )}
      {!loading && !error && orders.length > 0 && (
        <ProductionTable orders={orders} meta={meta} onPageChange={setPage} />
      )}
    </div>
  );
}
