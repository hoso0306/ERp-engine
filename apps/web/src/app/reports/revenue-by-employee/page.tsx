"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, Loading, ErrorState, EmptyState } from "@/components/shared";
import { StatTile } from "@/components/dashboard/stat-tile";
import {
  ReportRangeFilter,
  ReportExportButtons,
  ReportRankingTable,
  formatMoney,
  defaultReportRange,
  type RankingRow,
} from "@/components/report";
import { apiGet } from "@/lib/api";

interface RevenueByEmployeeReport {
  totalRevenue: number;
  employees: { ownerId: string | null; ownerName: string | null; orderCount: number; revenue: number; revenuePercent: number }[];
}

// C1 — Doanh thu theo nhân viên (report.md: SalesOrder.totalAmount group
// theo ownerId — ownerName chỉ là snapshot hiển thị).
export default function RevenueByEmployeeReportPage() {
  const initial = defaultReportRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [data, setData] = useState<RevenueByEmployeeReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from, to });
      const json = await apiGet<RevenueByEmployeeReport>(`/reports/revenue-by-employee?${params}`);
      setData(json);
    } catch {
      setError("Không thể tải báo cáo doanh thu theo nhân viên.");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const rows: RankingRow[] =
    data?.employees.map((e) => ({
      id: e.ownerId ?? "unknown",
      label: e.ownerName ?? "Không xác định",
      sublabel: `${e.orderCount} đơn`,
      value: e.revenue,
      percent: e.revenuePercent,
    })) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Doanh thu theo nhân viên"
        description="Doanh thu mang về theo người phụ trách đơn hàng"
        actions={
          <div className="flex items-center gap-2">
            <ReportRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
            <ReportExportButtons reportName="revenue-by-employee" from={from} to={to} />
          </div>
        }
      />

      {loading && !data && <Loading />}
      {error && !data && <ErrorState description={error} onRetry={fetchData} />}

      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <StatTile label="Tổng doanh thu" value={formatMoney(data.totalRevenue)} />
            <StatTile label="Số nhân viên có doanh số" value={String(data.employees.length)} />
          </div>

          {rows.length > 0 ? (
            <ReportRankingTable rows={rows} labelHeader="Nhân viên" valueHeader="Doanh thu" formatValue={formatMoney} />
          ) : (
            <EmptyState description="Không có dữ liệu bán hàng trong kỳ đã chọn." />
          )}
        </div>
      )}
    </div>
  );
}
