"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader, Loading, ErrorState } from "@/components/shared";
import { StatTile } from "@/components/dashboard/stat-tile";
import {
  ReportRangeFilter,
  ReportExportButtons,
  ReportTrendChart,
  formatMoney,
  autoGroupBy,
  defaultReportRange,
} from "@/components/report";
import { apiGet } from "@/lib/api";

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CASH: "Tiền mặt",
  BANK_TRANSFER: "Chuyển khoản",
};

interface CashInReport {
  totalCashIn: number;
  paymentCount: number;
  byMethod: { paymentMethod: string; count: number; amount: number }[];
  series: { period: string; cashIn: number; paymentCount: number }[];
}

// A2 — Báo cáo tiền mặt về (report.md: Payment.amount, mốc paymentDate).
// Chỉ số Actual — không cộng lẫn với A1/A3 (Planned).
export default function CashInReportPage() {
  const initial = defaultReportRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [data, setData] = useState<CashInReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const groupBy = useMemo(() => autoGroupBy(from, to), [from, to]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from, to, groupBy });
      const json = await apiGet<CashInReport>(`/reports/cash-in?${params}`);
      setData(json);
    } catch {
      setError("Không thể tải báo cáo tiền mặt về.");
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
        title="Báo cáo tiền mặt về"
        description="Tiền thật đã thu (Actual) — không phải doanh thu kế hoạch"
        actions={
          <div className="flex items-center gap-2">
            <ReportRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
            <ReportExportButtons reportName="cash-in" from={from} to={to} groupBy={groupBy} />
          </div>
        }
      />

      {loading && !data && <Loading />}
      {error && !data && <ErrorState description={error} onRetry={fetchData} />}

      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile label="Tổng tiền về" value={formatMoney(data.totalCashIn)} />
            <StatTile label="Số phiếu thu" value={String(data.paymentCount)} />
            {data.byMethod.map((m) => (
              <StatTile
                key={m.paymentMethod}
                label={PAYMENT_METHOD_LABEL[m.paymentMethod] ?? m.paymentMethod}
                value={formatMoney(m.amount)}
                sub={`${m.count} phiếu`}
              />
            ))}
          </div>

          <ReportTrendChart
            data={data.series}
            variant={groupBy === "day" ? "bar" : "line"}
            series={[{ key: "cashIn", label: "Tiền mặt về", color: "var(--chart-2)", formatValue: formatMoney }]}
          />
        </div>
      )}
    </div>
  );
}
