"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { PageHeader, Loading, ErrorState, EmptyState } from "@/components/shared";
import {
  ReceivableFilter,
  type ReceivableTab,
  type ReceivableSort,
} from "@/components/debt/receivable-filter";
import { ReceivableTable } from "@/components/debt/receivable-table";
import { DebtDashboardPanel } from "@/components/debt/debt-dashboard-panel";
import { apiGet } from "@/lib/api";

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
  };
}

export default function DebtsPage() {
  const [receivables, setReceivables] = useState<ReceivableRow[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<ReceivableTab>("all");
  const [risk, setRisk] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [sortBy, setSortBy] = useState<ReceivableSort>("default");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      if (sortBy !== "default") params.set("sortBy", sortBy);
      params.set("page", String(page));
      params.set("limit", "10");

      const json = await apiGet<{ data: ReceivableRow[]; meta: typeof meta }>(`/receivables?${params}`);
      setReceivables(json.data);
      setMeta(json.meta);
    } catch {
      setError("Không thể tải danh sách công nợ.");
    } finally {
      setLoading(false);
    }
  }, [search, tab, risk, paymentStatus, sortBy, page]);

  useEffect(() => {
    const timer = setTimeout(fetchReceivables, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchReceivables, search]);

  useEffect(() => {
    setPage(1);
  }, [search, tab, risk, paymentStatus, sortBy]);

  // BE chưa hỗ trợ filter theo hạn thanh toán (ReceivableQueryDto không có
  // field này) — lọc phía FE trên trang dữ liệu hiện tại, cùng pattern với
  // Ngày giao ở Đơn hàng.
  const filteredReceivables = useMemo(() => {
    if (!dueFrom && !dueTo) return receivables;
    return receivables.filter((r) => {
      if (!r.dueDate) return false;
      const d = new Date(r.dueDate);
      if (dueFrom && d < new Date(dueFrom)) return false;
      if (dueTo && d > new Date(dueTo)) return false;
      return true;
    });
  }, [receivables, dueFrom, dueTo]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Công nợ"
        description={
          <>
            Theo dõi công nợ phải thu và ghi nhận thanh toán
            <br />
            <span className="text-amber-600 dark:text-amber-500">
              Chú ý: Công nợ không bao gồm các đơn &quot;chưa giao hàng&quot;.
            </span>
          </>
        }
      />

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
        <ReceivableTable receivables={filteredReceivables} meta={meta} onPageChange={setPage} />
      )}
    </div>
  );
}
