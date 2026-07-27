"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader, Loading, ErrorState, EmptyState } from "@/components/shared";
import { VatSettlementTable } from "@/components/debt/vat-settlement-table";
import { apiGet } from "@/lib/api";

interface VatSettlementRow {
  id: string;
  code: string;
  customerId: string;
  status: string;
  totalAmount: number;
  createdAt: string;
}

// Tách ra route riêng (rà soát tab Công nợ, chốt 26/07/2026) — trước đây là
// 1 tab bên trong /debts, nhưng VAT Settlement là 1 resource khác hẳn
// (VatSettlement, không phải Receivable) nên xứng đáng có route độc lập,
// khớp với /vat-settlements/new, /vat-settlements/[id] đã có sẵn.
export default function VatSettlementsPage() {
  const [settlements, setSettlements] = useState<VatSettlementRow[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVatSettlements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await apiGet<{ data: VatSettlementRow[]; meta: typeof meta }>(
        `/vat-settlements?page=${page}&limit=10`,
      );
      setSettlements(json.data);
      setMeta(json.meta);
    } catch {
      setError("Không thể tải danh sách VAT Settlement.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchVatSettlements();
  }, [fetchVatSettlements]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="VAT Settlement"
        description={
          <>
            Các đơn đã thu tiền mặt không xuất hoá đơn, nay khách quay lại yêu cầu xuất hoá đơn
            <br />
            <Link href="/debts" className="inline-flex items-center gap-1 text-primary underline underline-offset-2">
              <ArrowLeft className="h-3.5 w-3.5" />
              Quay lại Công nợ
            </Link>
          </>
        }
      />

      {loading && <Loading />}
      {error && <ErrorState description={error} onRetry={fetchVatSettlements} />}
      {!loading && !error && settlements.length === 0 && (
        <EmptyState
          title="Chưa có VAT Settlement"
          description="Tạo VAT Settlement từ trang chi tiết công nợ đã đóng theo chế độ tiền mặt không xuất hóa đơn."
        />
      )}
      {!loading && !error && settlements.length > 0 && (
        <VatSettlementTable settlements={settlements} meta={meta} onPageChange={setPage} />
      )}
    </div>
  );
}
