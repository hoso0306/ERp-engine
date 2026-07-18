"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader, Loading, ErrorState, EmptyState } from "@/components/shared";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  byMonth: { period: string; revenue: number }[];
}

interface GrowthByProductTypeReport {
  months: string[];
  productTypes: ProductTypeGrowth[];
}

const MAX_DIRECT_SERIES = 5;
const OTHER_KEY = "__other";

// B4 — Tăng trưởng theo nhóm sản phẩm (report.md: SalesOrderItem.subtotal
// group theo productTypeId/productTypeName snapshot + theo tháng). Không có
// revenuePercent trả về từ BE nên FE không tự tính tỷ trọng (Report chỉ
// hiển thị, không tính lại số liệu).
export default function GrowthByProductTypeReportPage() {
  const initial = defaultReportRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [data, setData] = useState<GrowthByProductTypeReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from, to });
      const json = await apiGet<GrowthByProductTypeReport>(`/reports/growth-by-product-type?${params}`);
      setData(json);
    } catch {
      setError("Không thể tải báo cáo tăng trưởng theo nhóm sản phẩm.");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const { chartData, chartSeries } = useMemo(() => {
    if (!data) return { chartData: [], chartSeries: [] as ReportTrendSeries[] };

    // productTypes đã sắp xếp desc theo revenue từ BE — 5 nhóm đầu hiển thị
    // riêng màu, phần còn lại gộp "Khác" (dataviz: quá 4-5 categorical thì
    // fold, không sinh thêm màu).
    const top = data.productTypes.slice(0, MAX_DIRECT_SERIES);
    const rest = data.productTypes.slice(MAX_DIRECT_SERIES);

    const series: ReportTrendSeries[] = top.map((t, i) => ({
      key: t.productTypeId,
      label: t.productTypeName,
      color: `var(--chart-${i + 1})`,
      formatValue: formatMoney,
    }));
    if (rest.length > 0) {
      series.push({ key: OTHER_KEY, label: "Khác", color: "var(--muted-foreground)", formatValue: formatMoney });
    }

    const points = data.months.map((month) => {
      const point: { period: string } & Record<string, number | string> = { period: month };
      for (const t of top) {
        point[t.productTypeId] = t.byMonth.find((m) => m.period === month)?.revenue ?? 0;
      }
      if (rest.length > 0) {
        point[OTHER_KEY] = rest.reduce(
          (sum, t) => sum + (t.byMonth.find((m) => m.period === month)?.revenue ?? 0),
          0,
        );
      }
      return point;
    });

    return { chartData: points, chartSeries: series };
  }, [data]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tăng trưởng theo nhóm sản phẩm"
        description="Doanh thu theo nhóm sản phẩm (snapshot), theo tháng"
        actions={
          <div className="flex items-center gap-2">
            <ReportRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
            <ReportExportButtons reportName="growth-by-product-type" from={from} to={to} />
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
          <ReportTrendChart data={chartData} series={chartSeries} variant="line" />

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nhóm sản phẩm</TableHead>
                  <TableHead className="text-right">Doanh thu</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.productTypes.map((t) => (
                  <TableRow key={t.productTypeId}>
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
