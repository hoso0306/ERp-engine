"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, Loading, ErrorState } from "@/components/shared";
import { StatTile } from "@/components/dashboard/stat-tile";
import { Button } from "@/components/ui/button";
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

type GroupBy = "day" | "week" | "month" | "year";

// A1 — Báo cáo doanh thu (report.md: SalesOrder.totalAmount, mốc createdAt).
export default function RevenueReportPage() {
  const initial = defaultReportRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [groupBy, setGroupBy] = useState<GroupBy>(() => autoGroupBy(initial.from, initial.to));
  const [data, setData] = useState<RevenueReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-md border p-0.5">
              <Button variant={groupBy === "day" ? "default" : "ghost"} size="sm" onClick={() => setGroupBy("day")}>
                Ngày
              </Button>
              <Button variant={groupBy === "week" ? "default" : "ghost"} size="sm" onClick={() => setGroupBy("week")}>
                Tuần
              </Button>
              <Button variant={groupBy === "month" ? "default" : "ghost"} size="sm" onClick={() => setGroupBy("month")}>
                Tháng
              </Button>
              <Button variant={groupBy === "year" ? "default" : "ghost"} size="sm" onClick={() => setGroupBy("year")}>
                Năm
              </Button>
            </div>
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
