"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Loading, ErrorState, EmptyState } from "@/components/shared";
import {
  QuotationFilter,
  TAB_STATUS_PARAM,
  type QuotationTab,
} from "@/components/quotation/quotation-filter";
import { QuotationTable } from "@/components/quotation/quotation-table";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

export default function QuotationsPage() {
  const { hasPermission } = useAuth();
  const [quotations, setQuotations] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [search, setSearch] = useState("");
  // Mặc định tab "Chờ xử lý" (DRAFT + SENT) — thiết kế chốt 08/07/2026.
  const [tab, setTab] = useState<QuotationTab>("pending");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuotations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const statusParam = TAB_STATUS_PARAM[tab];
      if (statusParam) params.set("status", statusParam);
      if (dateFrom) params.set("createdFrom", dateFrom);
      if (dateTo) params.set("createdTo", dateTo);
      params.set("page", String(page));
      params.set("limit", "10");

      const json = await apiGet<{ data: never[]; meta: typeof meta }>(`/quotations?${params}`);
      setQuotations(json.data);
      setMeta(json.meta);
    } catch {
      setError("Không thể tải danh sách báo giá.");
    } finally {
      setLoading(false);
    }
  }, [search, tab, dateFrom, dateTo, page]);

  useEffect(() => {
    const timer = setTimeout(fetchQuotations, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchQuotations, search]);

  useEffect(() => {
    setPage(1);
  }, [search, tab, dateFrom, dateTo]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Báo giá"
        description="Quản lý danh sách báo giá"
        actions={
          hasPermission("quotation.create") ? (
            <Button render={<Link href="/quotations/new" />}>
              <Plus className="mr-2 h-4 w-4" />
              Tạo báo giá
            </Button>
          ) : undefined
        }
      />

      <QuotationFilter
        search={search}
        onSearchChange={setSearch}
        tab={tab}
        onTabChange={setTab}
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
      />

      {loading && <Loading />}
      {error && <ErrorState description={error} onRetry={fetchQuotations} />}
      {!loading && !error && quotations.length === 0 && (
        <EmptyState
          title="Không có báo giá"
          description={
            tab === "pending"
              ? "Không có báo giá nào đang chờ xử lý."
              : "Không có báo giá nào khớp bộ lọc."
          }
        />
      )}
      {!loading && !error && quotations.length > 0 && (
        <QuotationTable quotations={quotations} meta={meta} onPageChange={setPage} />
      )}
    </div>
  );
}
