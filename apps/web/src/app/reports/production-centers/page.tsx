"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, Loading, ErrorState, EmptyState } from "@/components/shared";
import { StatTile } from "@/components/dashboard/stat-tile";
import {
  ReportRangeFilter,
  ReportRankingTable,
  formatMoney,
  defaultReportRange,
  type RankingRow,
} from "@/components/report";
import { apiGet } from "@/lib/api";

// Lợi nhuận kế hoạch (031) chỉ có khi role có thêm quyền report.profit — BE
// bỏ hẳn field khi thiếu quyền, FE dựa vào việc field có mặt hay không.
interface RevenueByProductionCenterReport {
  totalRevenue: number;
  totalPlannedProfit?: number;
  centers: {
    productionCenterId: string | null;
    productionCenterName: string | null;
    orderCount: number;
    revenue: number;
    revenuePercent: number;
    plannedProfit?: number;
  }[];
}

const formatMoneyRounded = (v: number) => formatMoney(Math.round(v));

// Nhóm Sản xuất — Doanh thu theo xưởng (sprint-04/028). GROSS: SUM thành
// tiền dòng đơn hàng theo xưởng (snapshot tại Approve), chưa trừ hàng hoàn.
// Dòng không có xưởng = bán lẻ vật tư, giữ lại để tổng khớp doanh thu gross.
// Bấm tên xưởng → báo cáo chi tiết /reports/production-centers/[id].
export default function RevenueByProductionCenterReportPage() {
  const initial = defaultReportRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [data, setData] = useState<RevenueByProductionCenterReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from, to });
      const json = await apiGet<RevenueByProductionCenterReport>(`/reports/revenue-by-production-center?${params}`);
      setData(json);
    } catch {
      setError("Không thể tải báo cáo doanh thu theo xưởng.");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const rows: RankingRow[] =
    data?.centers.map((c) => ({
      id: c.productionCenterId ?? "retail",
      label: c.productionCenterId ? (c.productionCenterName ?? "—") : "Bán lẻ vật tư",
      sublabel: `${c.orderCount} đơn`,
      value: c.revenue,
      percent: c.revenuePercent,
      href: c.productionCenterId ? `/reports/production-centers/${c.productionCenterId}` : undefined,
      extraValue: c.plannedProfit,
    })) ?? [];
  const canViewProfit = data?.totalPlannedProfit !== undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Doanh thu theo xưởng"
        description="Doanh thu theo xưởng sản xuất, chưa trừ hàng hoàn"
        actions={<ReportRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />}
      />

      {loading && !data && <Loading />}
      {error && !data && <ErrorState description={error} onRetry={fetchData} />}

      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <StatTile label="Tổng doanh thu (chưa trừ hoàn)" value={formatMoney(data.totalRevenue)} />
            {canViewProfit && (
              <StatTile label="Tổng lợi nhuận kế hoạch" value={formatMoneyRounded(data.totalPlannedProfit ?? 0)} />
            )}
            <StatTile label="Số xưởng có doanh thu" value={String(data.centers.filter((c) => c.productionCenterId).length)} />
          </div>

          {rows.length > 0 ? (
            <ReportRankingTable
              rows={rows}
              labelHeader="Xưởng"
              valueHeader="Doanh thu"
              formatValue={formatMoney}
              extraColumn={canViewProfit ? { header: "Lợi nhuận kế hoạch", format: formatMoneyRounded } : undefined}
            />
          ) : (
            <EmptyState description="Không có dữ liệu bán hàng trong kỳ đã chọn." />
          )}
        </div>
      )}
    </div>
  );
}
