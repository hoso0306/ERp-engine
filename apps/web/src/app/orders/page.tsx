"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader, Loading, ErrorState, EmptyState, todayISO } from "@/components/shared";
import {
  SalesOrderFilter,
  TAB_STATUS_PARAM,
  type SalesOrderTab,
  type SalesOrderOwnerOption,
} from "@/components/sales-order/sales-order-filter";
import { SalesOrderTable } from "@/components/sales-order/sales-order-table";
import { SalesOrderExportButton } from "@/components/sales-order/sales-order-export-button";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

interface SalesOrderRow {
  id: string;
  code: string;
  customerName: string;
  customerPhone: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  // netAmount = totalAmount đã trừ phần Công ty hỗ trợ của hàng hoàn (rà
  // soát nghiệp vụ Return, 27/08/2026) — xem sales-order-table.tsx.
  netAmount?: number;
  totalProductionOrders: number;
  completedProductionOrders: number;
  expectedDeliveryDate: string | null;
  createdAt: string;
}

function OrdersPageContent() {
  const { user } = useAuth();
  // Deep-link từ trang "Tài khoản của tôi" (rà soát nghiệp vụ 27/08/2026) —
  // bấm "Doanh số của tôi" mở thẳng /orders?ownerId=self&createdFrom=...
  // &createdTo=...&excludeStatus=CANCELLED, chỉ đọc 1 LẦN lúc vào trang
  // (không đồng bộ ngược 2 chiều với URL sau đó, cùng cách trang này vốn
  // quản lý filter thuần bằng React state).
  const searchParams = useSearchParams();
  const initialOwnerId = searchParams.get("ownerId") ?? "all";
  const initialCreatedFrom = searchParams.get("createdFrom") ?? todayISO();
  const initialCreatedTo = searchParams.get("createdTo") ?? todayISO();
  const initialExcludeStatus = searchParams.get("excludeStatus") ?? "";

  const [orders, setOrders] = useState<SalesOrderRow[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [search, setSearch] = useState("");
  // Mặc định "Tất cả" + Ngày tạo "Hôm nay" (thiết kế chốt lúc rà soát bộ lọc
  // Đơn hàng) — vào trang thấy ngay các đơn phát sinh hôm nay, không giới hạn
  // trạng thái.
  const [tab, setTab] = useState<SalesOrderTab>("all");
  const [createdFrom, setCreatedFrom] = useState(initialCreatedFrom);
  const [createdTo, setCreatedTo] = useState(initialCreatedTo);
  const [deliveryFrom, setDeliveryFrom] = useState("");
  const [deliveryTo, setDeliveryTo] = useState("");
  // Bộ lọc "Người phụ trách" — mặc định "all" để giữ đúng hành vi hiện có
  // (trang vẫn hiện toàn bộ đơn như trước), không tự ý bó hẹp view của
  // người dùng hiện tại xuống chỉ đơn của họ.
  const [ownerId, setOwnerId] = useState(initialOwnerId);
  const [owners, setOwners] = useState<SalesOrderOwnerOption[]>([]);
  // Loại trừ 1 trạng thái cụ thể (rà soát nghiệp vụ 27/08/2026) — chỉ dùng
  // khi vào trang qua deep-link (vd loại Đã huỷ từ "Doanh số của tôi"), tab
  // "Tất cả" trở thành "Tất cả trừ X". Không có UI riêng để tự chọn — bỏ qua
  // ngay khi người dùng chọn 1 tab trạng thái cụ thể khác "Tất cả".
  const [excludeStatus] = useState(initialExcludeStatus);
  const [page, setPage] = useState(1);
  // Số dòng/trang (Pagination dùng chung, chốt 20/08/2026) — mặc định giữ
  // nguyên 10 như trước.
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<SalesOrderOwnerOption[]>("/sales-orders/export/owners")
      .then(setOwners)
      .catch(() => {});
  }, []);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const statusParam = TAB_STATUS_PARAM[tab];
      if (statusParam) params.set("status", statusParam);
      else if (tab === "all" && excludeStatus) params.set("excludeStatus", excludeStatus);
      if (ownerId === "self" && user) params.set("ownerId", user.id);
      else if (ownerId !== "all") params.set("ownerId", ownerId);
      if (createdFrom) params.set("createdFrom", createdFrom);
      if (createdTo) params.set("createdTo", createdTo);
      if (deliveryFrom) params.set("deliveryFrom", deliveryFrom);
      if (deliveryTo) params.set("deliveryTo", deliveryTo);
      params.set("page", String(page));
      params.set("limit", String(limit));

      const json = await apiGet<{ data: SalesOrderRow[]; meta: typeof meta }>(`/sales-orders?${params}`);
      setOrders(json.data);
      setMeta(json.meta);
    } catch {
      setError("Không thể tải danh sách đơn hàng.");
    } finally {
      setLoading(false);
    }
  }, [search, tab, excludeStatus, ownerId, user, createdFrom, createdTo, deliveryFrom, deliveryTo, page, limit]);

  useEffect(() => {
    const timer = setTimeout(fetchOrders, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchOrders, search]);

  useEffect(() => {
    setPage(1);
  }, [search, tab, ownerId, createdFrom, createdTo, deliveryFrom, deliveryTo, limit]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Đơn hàng"
        description="Theo dõi và vận hành đơn hàng sau khi báo giá được duyệt"
        actions={
          <SalesOrderExportButton
            search={search}
            status={TAB_STATUS_PARAM[tab]}
            ownerId={ownerId}
            createdFrom={createdFrom}
            createdTo={createdTo}
            deliveryFrom={deliveryFrom}
            deliveryTo={deliveryTo}
          />
        }
      />

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
        ownerId={ownerId}
        onOwnerIdChange={setOwnerId}
        owners={owners}
      />

      {loading && <Loading />}
      {error && <ErrorState description={error} onRetry={fetchOrders} />}
      {!loading && !error && orders.length === 0 && (
        <EmptyState
          title="Không có đơn hàng"
          description={
            createdFrom || createdTo || deliveryFrom || deliveryTo
              ? "Không có đơn hàng nào khớp khoảng ngày đã chọn."
              : "Không có đơn hàng nào khớp bộ lọc."
          }
        />
      )}
      {!loading && !error && orders.length > 0 && (
        <SalesOrderTable orders={orders} meta={meta} onPageChange={setPage} onLimitChange={setLimit} />
      )}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<Loading />}>
      <OrdersPageContent />
    </Suspense>
  );
}
