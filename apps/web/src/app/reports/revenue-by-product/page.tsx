"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, Loading, ErrorState, EmptyState } from "@/components/shared";
import { StatTile } from "@/components/dashboard/stat-tile";
import {
  ReportRangeFilter,
  ReportExportButtons,
  ReportRankingTable,
  formatMoney,
  formatNumber,
  defaultReportRange,
  type RankingRow,
} from "@/components/report";
import { apiGet } from "@/lib/api";

interface RevenueByProductReport {
  totalRevenue: number;
  products: {
    productId: string;
    productCode: string;
    productName: string;
    quantity: number;
    revenue: number;
    revenuePercent: number;
  }[];
}

// B2 — Cơ cấu doanh thu theo sản phẩm (report.md: SalesOrderItem.subtotal,
// group theo productId snapshot — không join ngược Product).
export default function RevenueByProductReportPage() {
  const initial = defaultReportRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [data, setData] = useState<RevenueByProductReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from, to });
      const json = await apiGet<RevenueByProductReport>(`/reports/revenue-by-product?${params}`);
      setData(json);
    } catch {
      setError("Không thể tải báo cáo doanh thu theo sản phẩm.");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const rows: RankingRow[] =
    data?.products.map((p) => ({
      id: p.productId,
      label: p.productName,
      sublabel: `${p.productCode} · SL ${formatNumber(p.quantity)}`,
      value: p.revenue,
      percent: p.revenuePercent,
    })) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Doanh thu theo sản phẩm"
        description="Cơ cấu doanh thu, top sản phẩm bán chạy"
        actions={
          <div className="flex items-center gap-2">
            <ReportRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
            <ReportExportButtons reportName="revenue-by-product" from={from} to={to} />
          </div>
        }
      />

      {loading && !data && <Loading />}
      {error && !data && <ErrorState description={error} onRetry={fetchData} />}

      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <StatTile label="Tổng doanh thu" value={formatMoney(data.totalRevenue)} />
            <StatTile label="Số sản phẩm bán ra" value={String(data.products.length)} />
          </div>

          {rows.length > 0 ? (
            <ReportRankingTable rows={rows} labelHeader="Sản phẩm" valueHeader="Doanh thu" formatValue={formatMoney} />
          ) : (
            <EmptyState description="Không có dữ liệu bán hàng trong kỳ đã chọn." />
          )}
        </div>
      )}
    </div>
  );
}
