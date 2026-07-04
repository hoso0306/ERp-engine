"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Loading, ErrorState, EmptyState } from "@/components/shared";
import { QuotationFilter } from "@/components/quotation/quotation-filter";
import { QuotationTable } from "@/components/quotation/quotation-table";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuotations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (status !== "all") params.set("status", status);
      params.set("page", String(page));
      params.set("limit", "10");

      const res = await fetch(`${API_URL}/api/quotations?${params}`);
      const json = await res.json();
      setQuotations(json.data);
      setMeta(json.meta);
    } catch {
      setError("Không thể tải danh sách báo giá.");
    } finally {
      setLoading(false);
    }
  }, [search, status, page]);

  useEffect(() => {
    const timer = setTimeout(fetchQuotations, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchQuotations, search]);

  useEffect(() => {
    setPage(1);
  }, [search, status]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Báo giá"
        description="Quản lý danh sách báo giá"
        actions={
          <Button render={<Link href="/quotations/new" />}>
            <Plus className="mr-2 h-4 w-4" />
            Tạo báo giá
          </Button>
        }
      />

      <QuotationFilter
        search={search}
        onSearchChange={setSearch}
        status={status}
        onStatusChange={setStatus}
      />

      {loading && <Loading />}
      {error && <ErrorState description={error} onRetry={fetchQuotations} />}
      {!loading && !error && quotations.length === 0 && (
        <EmptyState title="Chưa có báo giá" description="Chưa có báo giá nào được tạo." />
      )}
      {!loading && !error && quotations.length > 0 && (
        <QuotationTable quotations={quotations} meta={meta} onPageChange={setPage} />
      )}
    </div>
  );
}
