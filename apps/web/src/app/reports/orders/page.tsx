"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, Loading, ErrorState } from "@/components/shared";
import { StatTile } from "@/components/dashboard/stat-tile";
import { SalesOrderStatusBadge } from "@/components/sales-order/sales-order-status-badge";
import { PaymentStatusBadge } from "@/components/sales-order/payment-status-badge";
import { ReportRangeFilter, ReportExportButtons, formatMoney, defaultReportRange } from "@/components/report";
import { apiGet } from "@/lib/api";

interface OrdersReport {
  totalOrders: number;
  totalValue: number;
  averageOrderValue: number;
  byStatus: { status: string; count: number }[];
  byPaymentStatus: { paymentStatus: string; count: number }[];
  delivery: { evaluated: number; onTime: number; late: number; onTimePercent: number | null };
}

// B1 — Báo cáo đơn hàng (report.md: SalesOrder, mốc createdAt).
export default function OrdersReportPage() {
  const initial = defaultReportRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [data, setData] = useState<OrdersReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from, to });
      const json = await apiGet<OrdersReport>(`/reports/orders?${params}`);
      setData(json);
    } catch {
      setError("Không thể tải báo cáo đơn hàng.");
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
        title="Báo cáo đơn hàng"
        description="Số đơn theo trạng thái, giá trị trung bình, đúng/trễ hạn giao"
        actions={
          <div className="flex items-center gap-2">
            <ReportRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
            <ReportExportButtons reportName="orders" from={from} to={to} />
          </div>
        }
      />

      {loading && !data && <Loading />}
      {error && !data && <ErrorState description={error} onRetry={fetchData} />}

      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile label="Tổng số đơn" value={String(data.totalOrders)} />
            <StatTile label="Tổng giá trị" value={formatMoney(data.totalValue)} />
            <StatTile label="Giá trị TB/đơn" value={formatMoney(Math.round(data.averageOrderValue))} />
            <StatTile
              label="Giao đúng hạn"
              value={data.delivery.onTimePercent !== null ? `${data.delivery.onTimePercent.toFixed(1)}%` : "—"}
              sub={`${data.delivery.onTime}/${data.delivery.evaluated} đơn đã giao`}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2 rounded-lg border p-4">
              <p className="text-sm font-medium">Theo trạng thái</p>
              <div className="space-y-2">
                {data.byStatus.map((s) => (
                  <div key={s.status} className="flex items-center justify-between">
                    <SalesOrderStatusBadge status={s.status} />
                    <span className="text-sm font-mono">{s.count} đơn</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 rounded-lg border p-4">
              <p className="text-sm font-medium">Theo thanh toán</p>
              <div className="space-y-2">
                {data.byPaymentStatus.map((s) => (
                  <div key={s.paymentStatus} className="flex items-center justify-between">
                    <PaymentStatusBadge status={s.paymentStatus} />
                    <span className="text-sm font-mono">{s.count} đơn</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
