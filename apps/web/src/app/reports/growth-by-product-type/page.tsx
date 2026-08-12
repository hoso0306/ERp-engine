"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LineChart, BarChart3 } from "lucide-react";
import { PageHeader, Loading, ErrorState, EmptyState } from "@/components/shared";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ReportRangeFilter,
  ReportExportButtons,
  ReportTrendChart,
  type ReportTrendSeries,
  formatMoney,
  defaultReportRange,
} from "@/components/report";
import { apiGet } from "@/lib/api";

interface ProductTypeGrowth {
  productTypeId: string;
  productTypeName: string;
  revenue: number;
  byPeriod: { period: string; revenue: number }[];
}

interface GrowthByProductTypeReport {
  groupBy: "week" | "month" | "year";
  periods: string[];
  productTypes: ProductTypeGrowth[];
}

type GroupBy = "week" | "month" | "year";
type ChartVariant = "line" | "bar";

const DEFAULT_SELECTED_COUNT = 5;
const CHART_COLOR_COUNT = 5;

// B4 — Tăng trưởng theo nhóm sản phẩm (report.md: SalesOrderItem.subtotal
// group theo productTypeId/productTypeName snapshot + theo kỳ). Không có
// revenuePercent trả về từ BE nên FE không tự tính tỷ trọng (Report chỉ
// hiển thị, không tính lại số liệu).
export default function GrowthByProductTypeReportPage() {
  const initial = defaultReportRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [groupBy, setGroupBy] = useState<GroupBy>("month");
  const [chartVariant, setChartVariant] = useState<ChartVariant>("line");
  const [data, setData] = useState<GrowthByProductTypeReport | null>(null);
  const [selectedTypeIds, setSelectedTypeIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from, to, groupBy });
      const json = await apiGet<GrowthByProductTypeReport>(`/reports/growth-by-product-type?${params}`);
      setData(json);
      // Mặc định chọn 5 nhóm doanh thu cao nhất (đã sort desc từ BE) — mỗi
      // lần đổi kỳ/groupBy reset lại lựa chọn theo dữ liệu mới.
      setSelectedTypeIds(new Set(json.productTypes.slice(0, DEFAULT_SELECTED_COUNT).map((t) => t.productTypeId)));
    } catch {
      setError("Không thể tải báo cáo tăng trưởng theo nhóm sản phẩm.");
    } finally {
      setLoading(false);
    }
  }, [from, to, groupBy]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function toggleType(productTypeId: string) {
    setSelectedTypeIds((prev) => {
      const next = new Set(prev);
      if (next.has(productTypeId)) next.delete(productTypeId);
      else next.add(productTypeId);
      return next;
    });
  }

  const { chartData, chartSeries } = useMemo(() => {
    if (!data) return { chartData: [], chartSeries: [] as ReportTrendSeries[] };

    const selected = data.productTypes.filter((t) => selectedTypeIds.has(t.productTypeId));

    const series: ReportTrendSeries[] = selected.map((t, i) => ({
      key: t.productTypeId,
      label: t.productTypeName,
      color: `var(--chart-${(i % CHART_COLOR_COUNT) + 1})`,
      formatValue: formatMoney,
    }));

    const points = data.periods.map((period) => {
      const point: { period: string } & Record<string, number | string> = { period };
      for (const t of selected) {
        point[t.productTypeId] = t.byPeriod.find((p) => p.period === period)?.revenue ?? 0;
      }
      return point;
    });

    return { chartData: points, chartSeries: series };
  }, [data, selectedTypeIds]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tăng trưởng theo nhóm sản phẩm"
        description="Doanh thu theo nhóm sản phẩm (snapshot), theo tuần/tháng/năm"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-md border p-0.5">
              <Button variant={groupBy === "week" ? "default" : "ghost"} size="sm" onClick={() => setGroupBy("week")}>
                Theo tuần
              </Button>
              <Button variant={groupBy === "month" ? "default" : "ghost"} size="sm" onClick={() => setGroupBy("month")}>
                Theo tháng
              </Button>
              <Button variant={groupBy === "year" ? "default" : "ghost"} size="sm" onClick={() => setGroupBy("year")}>
                Theo năm
              </Button>
            </div>
            <div className="flex rounded-md border p-0.5">
              <Button
                variant={chartVariant === "line" ? "default" : "ghost"}
                size="sm"
                title="Biểu đồ đường"
                onClick={() => setChartVariant("line")}
              >
                <LineChart className="h-4 w-4" />
              </Button>
              <Button
                variant={chartVariant === "bar" ? "default" : "ghost"}
                size="sm"
                title="Biểu đồ cột"
                onClick={() => setChartVariant("bar")}
              >
                <BarChart3 className="h-4 w-4" />
              </Button>
            </div>
            <ReportRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
            <ReportExportButtons reportName="growth-by-product-type" from={from} to={to} groupBy={groupBy} />
          </div>
        }
      />

      {loading && !data && <Loading />}
      {error && !data && <ErrorState description={error} onRetry={fetchData} />}

      {data && data.productTypes.length === 0 && (
        <EmptyState description="Không có dữ liệu bán hàng trong kỳ đã chọn." />
      )}

      {data && data.productTypes.length > 0 && (
        <div className="space-y-6">
          {chartSeries.length > 0 ? (
            <ReportTrendChart data={chartData} series={chartSeries} variant={chartVariant} />
          ) : (
            <EmptyState description="Chưa chọn nhóm sản phẩm nào để hiển thị trên biểu đồ." />
          )}

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">Hiện</TableHead>
                  <TableHead>Nhóm sản phẩm</TableHead>
                  <TableHead className="text-right">Doanh thu</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.productTypes.map((t) => (
                  <TableRow
                    key={t.productTypeId}
                    className="cursor-pointer"
                    onClick={() => toggleType(t.productTypeId)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedTypeIds.has(t.productTypeId)}
                        onCheckedChange={() => toggleType(t.productTypeId)}
                      />
                    </TableCell>
                    <TableCell className="text-sm font-medium">{t.productTypeName}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatMoney(t.revenue)}</TableCell>
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
