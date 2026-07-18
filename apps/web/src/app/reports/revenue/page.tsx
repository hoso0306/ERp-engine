"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader, Loading, ErrorState } from "@/components/shared";
import { StatTile } from "@/components/dashboard/stat-tile";
import {
  ReportRangeFilter,
  ReportExportButtons,
  ReportTrendChart,
  formatMoney,
  formatPercent,
  autoGroupBy,
  defaultReportRange,
} from "@/components/report";
import { apiGet } from "@/lib/api";

interface RevenueReport {
  totalRevenue: number;
  orderCount: number;
  previousPeriod: { totalRevenue: number; orderCount: number };
  growthPercent: number | null;
  series: { period: string; revenue: number; orderCount: number }[];
}

// A1 — Báo cáo doanh thu (report.md: SalesOrder.totalAmount, mốc createdAt).
export default function RevenueReportPage() {
  const initial = defaultReportRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [data, setData] = useState<RevenueReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const groupBy = useMemo(() => autoGroupBy(from, to), [from, to]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from, to, groupBy });
      const json = await apiGet<RevenueReport>(`/reports/revenue?${params}`);
      setData(json);
    } catch {
      setError("Không thể tải báo cáo doanh thu.");
    } finally {
      setLoading(false);
    }
  }, [from, to, groupBy]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Báo cáo doanh thu"
        description="Doanh thu kế hoạch theo ngày chốt đơn, loại đơn huỷ"
        actions={
          <div className="flex items-center gap-2">
            <ReportRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
            <ReportExportButtons reportName="revenue" from={from} to={to} groupBy={groupBy} />
          </div>
        }
      />

      {loading && !data && <Loading />}
      {error && !data && <ErrorState description={error} onRetry={fetchData} />}

      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <StatTile label="Tổng doanh thu" value={formatMoney(data.totalRevenue)} />
            <StatTile label="Số đơn" value={String(data.orderCount)} />
            <StatTile
              label="So với kỳ trước"
              value={formatPercent(data.growthPercent)}
              sub={formatMoney(data.previousPeriod.totalRevenue)}
              tone={data.growthPercent !== null && data.growthPercent < 0 ? "danger" : "default"}
            />
          </div>

          <ReportTrendChart
            data={data.series}
            variant={groupBy === "day" ? "bar" : "line"}
            series={[{ key: "revenue", label: "Doanh thu", color: "var(--chart-1)", formatValue: formatMoney }]}
          />
        </div>
      )}
    </div>
  );
}
