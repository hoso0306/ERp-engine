"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { PageHeader, Loading, ErrorState, EmptyState, endOfDayBound } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { CreditCard } from "lucide-react";
import {
  ReceivableFilter,
  type ReceivableTab,
  type ReceivableSort,
} from "@/components/debt/receivable-filter";
import type { SalesOrderOwnerOption } from "@/components/sales-order/sales-order-filter";
import { ReceivableTable } from "@/components/debt/receivable-table";
import { DebtDashboardPanel } from "@/components/debt/debt-dashboard-panel";
import { DebtGroupSwitch } from "@/components/debt/debt-group-switch";
import { AllocatePaymentDialog } from "@/components/debt/allocate-payment-dialog";
import { ReceivableExportButton } from "@/components/debt/receivable-export-button";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

interface ReceivableRow {
  id: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate: string | null;
  salesOrder: {
    id: string;
    code: string;
    customerName: string;
    customerPhone: string;
    ownerName: string | null;
  };
}

export default function DebtsByOrderPage() {
  const { hasPermission, user } = useAuth();
  const [receivables, setReceivables] = useState<ReceivableRow[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<ReceivableTab>("all");
  const [risk, setRisk] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [sortBy, setSortBy] = useState<ReceivableSort>("default");
  // Bộ lọc "Người phụ trách" (rà soát 27/08/2026) — cùng field/pattern với
  // trang Đơn hàng (SalesOrder.ownerId). Mặc định "all" để giữ đúng hành vi
  // hiện có, không tự ý bó hẹp view của người dùng hiện tại.
  const [ownerId, setOwnerId] = useState("all");
  const [owners, setOwners] = useState<SalesOrderOwnerOption[]>([]);
  const [page, setPage] = useState(1);
  // Số dòng/trang (Pagination dùng chung, chốt 20/08/2026) — mặc định giữ
  // nguyên 10 như trước.
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allocateOpen, setAllocateOpen] = useState(false);

  useEffect(() => {
    apiGet<SalesOrderOwnerOption[]>("/sales-orders/export/owners")
      .then(setOwners)
      .catch(() => {});
  }, []);

  const fetchReceivables = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (tab === "overdue") params.set("overdue", "true");
      if (tab === "credit_exceeded") params.set("creditExceeded", "true");
      if (risk !== "all") params.set("risk", risk);
      if (paymentStatus !== "all") params.set("paymentStatus", paymentStatus);
      if (ownerId === "self" && user) params.set("ownerId", user.id);
      else if (ownerId !== "all") params.set("ownerId", ownerId);
      if (sortBy !== "default") params.set("sortBy", sortBy);
      params.set("page", String(page));
      params.set("limit", String(limit));

      const json = await apiGet<{ data: ReceivableRow[]; meta: typeof meta }>(`/receivables?${params}`);
      setReceivables(json.data);
      setMeta(json.meta);
    } catch {
      setError("Không thể tải danh sách công nợ.");
    } finally {
      setLoading(false);
    }
  }, [search, tab, risk, paymentStatus, ownerId, user, sortBy, page, limit]);

  useEffect(() => {
    const timer = setTimeout(fetchReceivables, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchReceivables, search]);

  useEffect(() => {
    setPage(1);
  }, [search, tab, risk, paymentStatus, ownerId, sortBy, limit]);

  // Tham số cho "In PDF" — cùng bộ lọc với fetchReceivables (bỏ page/limit,
  // in TOÀN BỘ khớp bộ lọc). Riêng dueFrom/dueTo: BE có sẵn from/to+dateField
  // (dùng cho tab Công nợ ở trang chi tiết khách hàng) nên tận dụng luôn cho
  // PDF, dù bảng đang hiển thị vẫn đang lọc khoảng này ở phía FE.
  const buildExportParams = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (tab === "overdue") params.set("overdue", "true");
    if (tab === "credit_exceeded") params.set("creditExceeded", "true");
    if (risk !== "all") params.set("risk", risk);
    if (paymentStatus !== "all") params.set("paymentStatus", paymentStatus);
    if (ownerId === "self" && user) params.set("ownerId", user.id);
    else if (ownerId !== "all") params.set("ownerId", ownerId);
    if (sortBy !== "default") params.set("sortBy", sortBy);
    if (dueFrom || dueTo) {
      params.set("dateField", "dueDate");
      if (dueFrom) params.set("from", dueFrom);
      if (dueTo) params.set("to", dueTo);
    }
    return params;
  }, [search, tab, risk, paymentStatus, ownerId, user, sortBy, dueFrom, dueTo]);

  // BE chưa hỗ trợ filter theo hạn thanh toán (ReceivableQueryDto không có
  // field này) — lọc phía FE trên trang dữ liệu hiện tại, cùng pattern với
  // Ngày giao ở Đơn hàng.
  const filteredReceivables = useMemo(() => {
    if (!dueFrom && !dueTo) return receivables;
    return receivables.filter((r) => {
      if (!r.dueDate) return false;
      const d = new Date(r.dueDate);
      if (dueFrom && d < new Date(dueFrom)) return false;
      if (dueTo && d > endOfDayBound(dueTo)) return false;
      return true;
    });
  }, [receivables, dueFrom, dueTo]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Công nợ"
        description="Theo dõi công nợ phải thu và ghi nhận thanh toán"
        actions={
          <div className="flex items-center gap-2">
            <ReceivableExportButton endpoint="/receivables/export" buildParams={buildExportParams} format="xlsx" />
            <ReceivableExportButton endpoint="/receivables/export" buildParams={buildExportParams} format="pdf" />
            {hasPermission("debt.create-payment") && (
              <Button onClick={() => setAllocateOpen(true)}>
                <CreditCard className="mr-2 h-4 w-4" />
                Ghi nhận thanh toán
              </Button>
            )}
          </div>
        }
      />

      <DebtGroupSwitch active="order" />

      <DebtDashboardPanel />

      <ReceivableFilter
        search={search}
        onSearchChange={setSearch}
        tab={tab}
        onTabChange={setTab}
        risk={risk}
        onRiskChange={setRisk}
        paymentStatus={paymentStatus}
        onPaymentStatusChange={setPaymentStatus}
        dueFrom={dueFrom}
        onDueFromChange={setDueFrom}
        dueTo={dueTo}
        onDueToChange={setDueTo}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        ownerId={ownerId}
        onOwnerIdChange={setOwnerId}
        owners={owners}
      />

      {loading && <Loading />}
      {error && <ErrorState description={error} onRetry={fetchReceivables} />}
      {!loading && !error && filteredReceivables.length === 0 && (
        <EmptyState
          title="Không có công nợ"
          description={
            dueFrom || dueTo
              ? "Không có công nợ nào khớp khoảng hạn thanh toán đã chọn."
              : "Không có công nợ nào khớp bộ lọc."
          }
        />
      )}
      {!loading && !error && filteredReceivables.length > 0 && (
        <ReceivableTable receivables={filteredReceivables} meta={meta} onPageChange={setPage} onLimitChange={setLimit} />
      )}

      <AllocatePaymentDialog
        open={allocateOpen}
        onOpenChange={setAllocateOpen}
        onSaved={fetchReceivables}
      />
    </div>
  );
}
