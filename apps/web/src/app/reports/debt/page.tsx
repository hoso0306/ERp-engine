"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, Loading, ErrorState } from "@/components/shared";
import { StatTile } from "@/components/dashboard/stat-tile";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReportRangeFilter, ReportExportButtons, formatMoney, defaultReportRange } from "@/components/report";
import { apiGet } from "@/lib/api";

interface RiskBucket {
  count: number;
  amount: number;
}

interface DebtReport {
  balance: {
    totalRemaining: number;
    overdueAmount: number;
    overdueCount: number;
    byRiskLevel: { LOW: RiskBucket; MEDIUM: RiskBucket; HIGH: RiskBucket };
    creditExceeded: { customerId: string; customerName: string; debtLimit: number; totalRemaining: number }[];
    topDebtors: { customerId: string; customerName: string; customerPhone: string; totalRemaining: number }[];
  };
  inRange: {
    newReceivableCount: number;
    newReceivableAmount: number;
    cashIn: { totalCashIn: number; paymentCount: number };
  };
}

// A4 — Báo cáo công nợ. balance = số dư hiện tại (KHÔNG theo kỳ), inRange =
// phát sinh trong kỳ — tách riêng 2 khối để không hiểu nhầm số dư là phát
// sinh (report.md A4).
export default function DebtReportPage() {
  const initial = defaultReportRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [data, setData] = useState<DebtReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from, to });
      const json = await apiGet<DebtReport>(`/reports/debt?${params}`);
      setData(json);
    } catch {
      setError("Không thể tải báo cáo công nợ.");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Báo cáo công nợ"
        description="Số dư hiện tại không theo kỳ — chỉ phần phát sinh áp dụng bộ lọc"
        actions={
          <div className="flex items-center gap-2">
            <ReportRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
            <ReportExportButtons reportName="debt" from={from} to={to} />
          </div>
        }
      />

      {loading && !data && <Loading />}
      {error && !data && <ErrorState description={error} onRetry={fetchData} />}

      {data && (
        <div className="space-y-8">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">SỐ DƯ HIỆN TẠI (không theo kỳ)</h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatTile label="Tổng còn phải thu" value={formatMoney(data.balance.totalRemaining)} />
              <StatTile
                label="Quá hạn"
                value={formatMoney(data.balance.overdueAmount)}
                sub={`${data.balance.overdueCount} phiếu`}
                tone={data.balance.overdueCount > 0 ? "danger" : "default"}
              />
              <StatTile
                label="Rủi ro trung bình / cao"
                value={formatMoney(data.balance.byRiskLevel.MEDIUM.amount + data.balance.byRiskLevel.HIGH.amount)}
                sub={`${data.balance.byRiskLevel.MEDIUM.count + data.balance.byRiskLevel.HIGH.count} phiếu`}
              />
              <StatTile label="Khách vượt hạn mức" value={String(data.balance.creditExceeded.length)} />
            </div>

            {data.balance.topDebtors.length > 0 && (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Top khách nợ</TableHead>
                      <TableHead className="text-right">Còn phải thu</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.balance.topDebtors.map((d) => (
                      <TableRow key={d.customerId}>
                        <TableCell>
                          {d.customerName}
                          <span className="ml-2 text-xs text-muted-foreground">{d.customerPhone}</span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">{formatMoney(d.totalRemaining)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">PHÁT SINH TRONG KỲ</h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <StatTile
                label="Công nợ mới"
                value={formatMoney(data.inRange.newReceivableAmount)}
                sub={`${data.inRange.newReceivableCount} phiếu`}
              />
              <StatTile
                label="Tiền thu trong kỳ"
                value={formatMoney(data.inRange.cashIn.totalCashIn)}
                sub={`${data.inRange.cashIn.paymentCount} phiếu thu`}
              />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
