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

// Tab "Đơn hàng" trong trang chi tiết khách hàng — toàn bộ đơn khách này từng
// mua, tái dùng GET /sales-orders?customerId= (đã hỗ trợ sẵn) + SalesOrderTable
// đang dùng ở trang /orders. BE sales-order chưa hỗ trợ filter theo ngày tạo
// (SalesOrderQueryDto không có field này) nên lọc phía FE trên trang dữ liệu
// hiện tại, cùng cách trang /orders đang làm.
export function CustomerOrdersTab({ customerId }: CustomerOrdersTabProps) {
  const [orders, setOrders] = useState<SalesOrderRow[]>([]);
  const [meta, setMeta] = useState<Meta>({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
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
