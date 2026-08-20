"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, Loading, ErrorState, EmptyState, DateRangeFilter } from "@/components/shared";
import { DebtGroupSwitch } from "@/components/debt/debt-group-switch";
import { PaymentListTable, type PaymentListRow } from "@/components/debt/payment-list-table";
import { apiGet } from "@/lib/api";

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Tab "Phiếu thu" (rà soát tab Công nợ, 11/08/2026) — trước đây chỉ xem được
// lịch sử thu tiền lồng trong từng đơn/khách hàng (GET /receivables/:id) hoặc
// qua export báo cáo (/reports/payments-list, không có màn hình xem trước).
// Trang này dùng GET /payments mới thêm để xem TẤT CẢ phiếu thu mọi khách
// hàng ngay trên UI, lọc theo khoảng ngày thu.
export default function DebtsPaymentsPage() {
  const [payments, setPayments] = useState<PaymentListRow[]>([]);
  const [meta, setMeta] = useState<Meta>({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  // Số dòng/trang (Pagination dùng chung, chốt 20/08/2026) — mặc định giữ
  // nguyên 10 như trước.
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      params.set("page", String(page));
      params.set("limit", String(limit));
      const json = await apiGet<{ data: PaymentListRow[]; meta: Meta }>(`/payments?${params}`);
      setPayments(json.data);
      setMeta(json.meta);
    } catch {
      setError("Không thể tải danh sách phiếu thu.");
    } finally {
      setLoading(false);
    }
  }, [from, to, page, limit]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  useEffect(() => {
    setPage(1);
  }, [from, to, limit]);

  return (
    <div className="space-y-6">
      <PageHeader title="Công nợ" description="Toàn bộ phiếu thu, lọc theo khoảng ngày thu" />

      <DebtGroupSwitch active="payments" />

      <div className="flex justify-end">
        <DateRangeFilter label="Ngày thu" dateFrom={from} onDateFromChange={setFrom} dateTo={to} onDateToChange={setTo} />
      </div>

      {loading && <Loading />}
      {error && <ErrorState description={error} onRetry={fetchPayments} />}
      {!loading && !error && payments.length === 0 && (
        <EmptyState
          title="Không có phiếu thu"
          description={from || to ? "Không có phiếu thu nào khớp khoảng ngày đã chọn." : "Chưa có phiếu thu nào."}
        />
      )}
      {!loading && !error && payments.length > 0 && (
        <PaymentListTable rows={payments} meta={meta} onPageChange={setPage} onLimitChange={setLimit} onReversed={fetchPayments} showCustomer />
      )}
    </div>
  );
}
