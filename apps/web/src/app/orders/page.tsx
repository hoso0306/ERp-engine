"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { PageHeader, Loading, ErrorState, EmptyState, todayISO } from "@/components/shared";
import {
  SalesOrderFilter,
  TAB_STATUS_PARAM,
  type SalesOrderTab,
} from "@/components/sales-order/sales-order-filter";
import { SalesOrderTable } from "@/components/sales-order/sales-order-table";
import { apiGet } from "@/lib/api";

interface SalesOrderRow {
  id: string;
  code: string;
  customerName: string;
  customerPhone: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  totalProductionOrders: number;
  completedProductionOrders: number;
  expectedDeliveryDate: string | null;
  createdAt: string;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<SalesOrderRow[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [search, setSearch] = useState("");
  // Mặc định "Tất cả" + Ngày tạo "Hôm nay" (thiết kế chốt lúc rà soát bộ lọc
  // Đơn hàng) — vào trang thấy ngay các đơn phát sinh hôm nay, không giới hạn
  // trạng thái.
  const [tab, setTab] = useState<SalesOrderTab>("all");
  const [createdFrom, setCreatedFrom] = useState(todayISO());
  const [createdTo, setCreatedTo] = useState(todayISO());
  const [deliveryFrom, setDeliveryFrom] = useState("");
  const [deliveryTo, setDeliveryTo] = useState("");
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
      params.set("page", String(page));
      params.set("limit", "10");

      const json = await apiGet<{ data: SalesOrderRow[]; meta: typeof meta }>(`/sales-orders?${params}`);
      setOrders(json.data);
      setMeta(json.meta);
    } catch {
      setError("Không thể tải danh sách đơn hàng.");
    } finally {
      setLoading(false);
    }
  }, [search, tab, page]);

  useEffect(() => {
    const timer = setTimeout(fetchOrders, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchOrders, search]);

  useEffect(() => {
    setPage(1);
  }, [search, tab]);

  // BE chưa hỗ trợ filter theo ngày giao dự kiến / ngày tạo (SalesOrderQueryDto
  // không có field này) — lọc phía FE trên trang dữ liệu hiện tại, theo thiết kế
  // đã chốt ở 004-fe-don-hang.md (không thêm query param BE mới).
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (createdFrom || createdTo) {
        const c = new Date(o.createdAt);
        if (createdFrom && c < new Date(createdFrom)) return false;
        if (createdTo && c > new Date(createdTo)) return false;
      }
      if (deliveryFrom || deliveryTo) {
        if (!o.expectedDeliveryDate) return false;
        const d = new Date(o.expectedDeliveryDate);
        if (deliveryFrom && d < new Date(deliveryFrom)) return false;
        if (deliveryTo && d > new Date(deliveryTo)) return false;
      }
      return true;
    });
  }, [orders, createdFrom, createdTo, deliveryFrom, deliveryTo]);

  return (
    <div className="space-y-6">
      <PageHeader title="Đơn hàng" description="Theo dõi và vận hành đơn hàng sau khi báo giá được duyệt" />

      <SalesOrderFilter
        search={search}
        onSearchChange={setSearch}
        tab={tab}
        onTabChange={setTab}
        createdFrom={createdFrom}
        onCreatedFromChange={setCreatedFrom}
        createdTo={createdTo}
        onCreatedToChange={setCreatedTo}
        deliveryFrom={deliveryFrom}
        onDeliveryFromChange={setDeliveryFrom}
        deliveryTo={deliveryTo}
        onDeliveryToChange={setDeliveryTo}
      />

      {loading && <Loading />}
      {error && <ErrorState description={error} onRetry={fetchOrders} />}
      {!loading && !error && filteredOrders.length === 0 && (
        <EmptyState
          title="Không có đơn hàng"
          description={
            createdFrom || createdTo || deliveryFrom || deliveryTo
              ? "Không có đơn hàng nào khớp khoảng ngày đã chọn."
              : "Không có đơn hàng nào khớp bộ lọc."
          }
        />
      )}
      {!loading && !error && filteredOrders.length > 0 && (
        <SalesOrderTable orders={filteredOrders} meta={meta} onPageChange={setPage} />
      )}
    </div>
  );
}
