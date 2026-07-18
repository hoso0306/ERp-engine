"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, Loading, ErrorState, EmptyState } from "@/components/shared";
import { StatTile } from "@/components/dashboard/stat-tile";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RETURN_REASON_LABEL } from "@/components/return/return-reason-label";
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

interface ReturnsReport {
  summary: {
    returnsInRange: number;
    totalProductsReturnedInRange: number;
    returnValueInRange: number;
  };
  topReasons: { reason: string; count: number; returnedQuantity: number; percent: number }[];
  byCustomer: { customerId: string; customerName: string; returnCount: number }[];
}

// D2 — Báo cáo hàng hoàn (report.md: Return/ReturnItem, mốc returnDate).
// Giá trị hoàn hiển thị RIÊNG, không trừ vào doanh thu (return.md).
export default function ReturnsReportPage() {
  const initial = defaultReportRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [data, setData] = useState<ReturnsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from, to });
      const json = await apiGet<ReturnsReport>(`/reports/returns?${params}`);
      setData(json);
    } catch {
      setError("Không thể tải báo cáo hàng hoàn.");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const reasonRows: RankingRow[] =
    data?.topReasons.map((r) => ({
      id: r.reason,
      label: RETURN_REASON_LABEL[r.reason] ?? r.reason,
      sublabel: `SL hoàn: ${formatNumber(r.returnedQuantity)}`,
      value: r.count,
      percent: r.percent,
    })) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Báo cáo hàng hoàn"
        description="Giá trị hoàn hiển thị riêng — không trừ vào doanh thu"
        actions={
          <div className="flex items-center gap-2">
            <ReportRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
            <ReportExportButtons reportName="returns" from={from} to={to} />
          </div>
        }
      />

      {loading && !data && <Loading />}
      {error && !data && <ErrorState description={error} onRetry={fetchData} />}

      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <StatTile label="Số phiếu trả hàng" value={String(data.summary.returnsInRange)} />
            <StatTile label="Số sản phẩm hoàn" value={String(data.summary.totalProductsReturnedInRange)} />
            <StatTile label="Giá trị hàng hoàn" value={formatMoney(data.summary.returnValueInRange)} />
          </div>

          {data.summary.returnsInRange === 0 ? (
            <EmptyState description="Không có phiếu trả hàng nào trong kỳ đã chọn." />
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-medium">Top lý do hoàn</p>
                <ReportRankingTable rows={reasonRows} labelHeader="Lý do" valueHeader="Số phiếu" />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Theo khách hàng</p>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Khách hàng</TableHead>
                        <TableHead className="text-right">Số phiếu</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.byCustomer.map((c) => (
                        <TableRow key={c.customerId}>
                          <TableCell className="text-sm">{c.customerName}</TableCell>
                          <TableCell className="text-right text-sm">{c.returnCount}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
