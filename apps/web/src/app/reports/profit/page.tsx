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

interface ProfitReport {
  totalRevenue: number;
  totalPlannedCost: number;
  totalPlannedProfit: number;
  plannedProfitMarginPercent: number | null;
  previousPeriod: { totalPlannedProfit: number };
  growthPercent: number | null;
  series: { period: string; revenue: number; plannedCost: number; plannedProfit: number }[];
}

type GroupBy = "day" | "week" | "month" | "year";

// A3 — Báo cáo lợi nhuận KẾ HOẠCH (report.md: nhãn bắt buộc "kế hoạch",
// KHÔNG hiển thị chữ "lợi nhuận" trần trụi — V1 chưa có lợi nhuận thực tế).
export default function ProfitReportPage() {
  const initial = defaultReportRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [groupBy, setGroupBy] = useState<GroupBy>(() => autoGroupBy(initial.from, initial.to));
  const [data, setData] = useState<ProfitReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from, to, groupBy });
      const json = await apiGet<ProfitReport>(`/reports/profit?${params}`);
      setData(json);
    } catch {
      setError("Không thể tải báo cáo lợi nhuận kế hoạch.");
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
        title="Báo cáo lợi nhuận kế hoạch"
        description="Tính từ plannedCost/plannedProfit đã chốt — chưa phải lợi nhuận thực tế"
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
            <ReportExportButtons reportName="profit" from={from} to={to} groupBy={groupBy} />
          </div>
        }
      />

      {loading && !data && <Loading />}
      {error && !data && <ErrorState description={error} onRetry={fetchData} />}

      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile label="Doanh thu" value={formatMoney(data.totalRevenue)} />
            <StatTile label="Giá vốn kế hoạch" value={formatMoney(data.totalPlannedCost)} />
            <StatTile label="Lợi nhuận kế hoạch" value={formatMoney(data.totalPlannedProfit)} />
            <StatTile
              label="Tỷ suất lợi nhuận kế hoạch"
              value={data.plannedProfitMarginPercent !== null ? `${data.plannedProfitMarginPercent.toFixed(1)}%` : "—"}
              sub={`So kỳ trước: ${formatPercent(data.growthPercent)}`}
            />
          </div>

          <ReportTrendChart
            data={data.series}
            variant={groupBy === "day" ? "bar" : "line"}
            series={[
              { key: "revenue", label: "Doanh thu", color: "var(--chart-1)", formatValue: formatMoney },
              { key: "plannedCost", label: "Giá vốn kế hoạch", color: "var(--chart-4)", formatValue: formatMoney },
              { key: "plannedProfit", label: "Lợi nhuận kế hoạch", color: "var(--chart-2)", formatValue: formatMoney },
            ]}
          />
        </div>
      )}
    </div>
  );
}
