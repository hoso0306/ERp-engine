"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, Loading, ErrorState } from "@/components/shared";
import { StatTile } from "@/components/dashboard/stat-tile";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ReportRangeFilter,
  ReportExportButtons,
  ReportTrendChart,
  formatMoney,
  formatPercent,
  defaultReportRange,
} from "@/components/report";
import { apiGet } from "@/lib/api";

interface GrowthPoint {
  period: string;
  revenue: number;
  cashIn: number;
  plannedProfit: number;
  revenueGrowthPercent: number | null;
  revenueGrowthYoYPercent: number | null;
}

interface GrowthReport {
  groupBy: "month" | "year";
  totals: { revenue: number; cashIn: number; plannedProfit: number };
  series: GrowthPoint[];
}

// B3 — Tốc độ phát triển qua các tháng/năm. KHÔNG phải method mới ở BE — tái
// dùng A1/A2/A3 với groupBy khác (report.md B3).
export default function GrowthReportPage() {
  const initial = defaultReportRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [groupBy, setGroupBy] = useState<"month" | "year">("month");
  const [data, setData] = useState<GrowthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from, to, groupBy });
      const json = await apiGet<GrowthReport>(`/reports/growth?${params}`);
      setData(json);
    } catch {
      setError("Không thể tải báo cáo tốc độ phát triển.");
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
        title="Tốc độ phát triển"
        description="Doanh thu, tiền về, lợi nhuận kế hoạch theo tháng/năm"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border p-0.5">
              <Button variant={groupBy === "month" ? "default" : "ghost"} size="sm" onClick={() => setGroupBy("month")}>
                Theo tháng
              </Button>
              <Button variant={groupBy === "year" ? "default" : "ghost"} size="sm" onClick={() => setGroupBy("year")}>
                Theo năm
              </Button>
            </div>
            <ReportRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
            <ReportExportButtons reportName="growth" from={from} to={to} groupBy={groupBy} />
          </div>
        }
      />

      {loading && !data && <Loading />}
      {error && !data && <ErrorState description={error} onRetry={fetchData} />}

      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <StatTile label="Tổng doanh thu" value={formatMoney(data.totals.revenue)} />
            <StatTile label="Tổng tiền về" value={formatMoney(data.totals.cashIn)} />
            <StatTile label="Tổng lợi nhuận kế hoạch" value={formatMoney(data.totals.plannedProfit)} />
          </div>

          <ReportTrendChart
            data={data.series}
            variant="line"
            series={[
              { key: "revenue", label: "Doanh thu", color: "var(--chart-1)", formatValue: formatMoney },
              { key: "cashIn", label: "Tiền mặt về", color: "var(--chart-2)", formatValue: formatMoney },
              { key: "plannedProfit", label: "Lợi nhuận kế hoạch", color: "var(--chart-4)", formatValue: formatMoney },
            ]}
          />

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kỳ</TableHead>
                  <TableHead className="text-right">Doanh thu</TableHead>
                  <TableHead className="text-right">Tiền về</TableHead>
                  <TableHead className="text-right">Lợi nhuận kế hoạch</TableHead>
                  <TableHead className="text-right">% so kỳ trước</TableHead>
                  <TableHead className="text-right">% cùng kỳ năm trước</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.series.map((p) => (
                  <TableRow key={p.period}>
                    <TableCell className="font-medium">{p.period}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatMoney(p.revenue)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatMoney(p.cashIn)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatMoney(p.plannedProfit)}</TableCell>
                    <TableCell className="text-right text-sm">{formatPercent(p.revenueGrowthPercent)}</TableCell>
                    <TableCell className="text-right text-sm">{formatPercent(p.revenueGrowthYoYPercent)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
