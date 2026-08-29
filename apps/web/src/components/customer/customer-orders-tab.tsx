"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loading, ErrorState, EmptyState, DateRangeFilter, endOfDayBound } from "@/components/shared";
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
  // netAmount = totalAmount đã trừ phần Công ty hỗ trợ của hàng hoàn (rà
  // soát nghiệp vụ Return, 27/08/2026) — dùng để tính "Tổng doanh số" bên
  // dưới, xem sales-order-table.tsx.
  netAmount?: number;
  totalProductionOrders: number;
  completedProductionOrders: number;
  expectedDeliveryDate: string | null;
  createdAt: string;
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface CustomerOrdersTabProps {
  customerId: string;
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("vi-VN").format(amount) + " ₫";
}

// Tab "Đơn hàng" trong trang chi tiết khách hàng — toàn bộ đơn khách này từng
// mua, tái dùng GET /sales-orders?customerId= + SalesOrderTable đang dùng ở
// trang /orders. Bảng vẫn lọc ngày phía FE trên trang dữ liệu hiện tại (chưa
// đổi sang server-side filter — SalesOrderQueryDto thật ra đã hỗ trợ
// createdFrom/createdTo, nhưng ngoài phạm vi đợt sửa 27/08/2026 này). Riêng
// "Tổng doanh số" bên dưới KHÔNG bị giới hạn theo trang — gọi riêng GET
// /sales-orders/revenue-summary (aggregate đúng toàn bộ khoảng lọc ở DB).
export function CustomerOrdersTab({ customerId }: CustomerOrdersTabProps) {
  const [orders, setOrders] = useState<SalesOrderRow[]>([]);
  const [meta, setMeta] = useState<Meta>({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // "Tổng doanh số" (rà soát nghiệp vụ Return, 27/08/2026) — tách riêng khỏi
  // bảng phân trang, gọi GET /sales-orders/revenue-summary (aggregate đúng
  // TOÀN BỘ khoảng lọc ở DB, không giới hạn theo trang đang xem như bảng).
  const [totalRevenue, setTotalRevenue] = useState(0);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("customerId", customerId);
      params.set("page", String(page));
      params.set("limit", "10");
      const json = await apiGet<{ data: SalesOrderRow[]; meta: Meta }>(`/sales-orders?${params}`);
      setOrders(json.data);
      setMeta(json.meta);
    } catch {
      setError("Không thể tải danh sách đơn hàng.");
    } finally {
      setLoading(false);
    }
  }, [customerId, page]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const filteredOrders = useMemo(() => {
    if (!createdFrom && !createdTo) return orders;
    return orders.filter((o) => {
      const c = new Date(o.createdAt);
      if (createdFrom && c < new Date(createdFrom)) return false;
      if (createdTo && c > endOfDayBound(createdTo)) return false;
      return true;
    });
  }, [orders, createdFrom, createdTo]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("customerId", customerId);
    if (createdFrom) params.set("from", createdFrom);
    if (createdTo) params.set("to", createdTo);
    apiGet<{ totalRevenue: number }>(`/sales-orders/revenue-summary?${params}`)
      .then((json) => setTotalRevenue(json.totalRevenue))
      .catch(() => setTotalRevenue(0));
  }, [customerId, createdFrom, createdTo]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        {!loading && !error && (
          <p className="text-sm">
            <span className="text-muted-foreground">Tổng doanh số: </span>
            <span className="font-mono font-semibold">{formatMoney(totalRevenue)}</span>
          </p>
        )}
        <DateRangeFilter
          label="Ngày tạo"
          dateFrom={createdFrom}
          onDateFromChange={setCreatedFrom}
          dateTo={createdTo}
          onDateToChange={setCreatedTo}
        />
      </div>

      {loading && <Loading />}
      {error && <ErrorState description={error} onRetry={fetchOrders} />}
      {!loading && !error && filteredOrders.length === 0 && (
        <EmptyState
          title="Chưa có đơn hàng"
          description={
            createdFrom || createdTo
              ? "Không có đơn hàng nào khớp khoảng ngày đã chọn."
              : "Khách hàng này chưa có đơn hàng nào."
          }
        />
      )}
      {!loading && !error && filteredOrders.length > 0 && (
        <SalesOrderTable orders={filteredOrders} meta={meta} onPageChange={setPage} />
      )}
    </div>
  );
}
