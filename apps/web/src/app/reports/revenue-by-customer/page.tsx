"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, Loading, ErrorState, EmptyState } from "@/components/shared";
import { StatTile } from "@/components/dashboard/stat-tile";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReportRangeFilter, ReportExportButtons, formatMoney, formatDate, defaultReportRange } from "@/components/report";
import { apiGet } from "@/lib/api";

interface CustomerRevenueRow {
  customerId: string;
  customerName: string;
  customerPhone: string;
  orderCount: number;
  revenue: number;
  firstOrderAt: string;
  lastOrderAt: string;
  currentDebt: number;
}

interface RevenueByCustomerReport {
  totalRevenue: number;
  customers: CustomerRevenueRow[];
  newCustomers: { count: number; customers: { id: string; code: string; name: string; phone: string; createdAt: string }[] };
}

// C2 — Doanh thu theo khách hàng (report.md: SalesOrder.totalAmount group
// theo customerId + khách mới trong kỳ (Customer.createdAt) + công nợ hiện
// tại (đọc realtime từ DebtService, không lưu vào customers)).
export default function RevenueByCustomerReportPage() {
  const initial = defaultReportRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [data, setData] = useState<RevenueByCustomerReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from, to });
      const json = await apiGet<RevenueByCustomerReport>(`/reports/revenue-by-customer?${params}`);
      setData(json);
    } catch {
      setError("Không thể tải báo cáo doanh thu theo khách hàng.");
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
        title="Doanh thu theo khách hàng"
        description="Top khách theo doanh thu, khách mới trong kỳ"
        actions={
          <div className="flex items-center gap-2">
            <ReportRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
            <ReportExportButtons reportName="revenue-by-customer" from={from} to={to} />
          </div>
        }
      />

      {loading && !data && <Loading />}
      {error && !data && <ErrorState description={error} onRetry={fetchData} />}

      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <StatTile label="Tổng doanh thu" value={formatMoney(data.totalRevenue)} />
            <StatTile label="Số khách có mua hàng" value={String(data.customers.length)} />
            <StatTile label="Khách mới trong kỳ" value={String(data.newCustomers.count)} />
          </div>

          {data.customers.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Khách hàng</TableHead>
                    <TableHead className="text-right">Số đơn</TableHead>
                    <TableHead className="text-right">Doanh thu</TableHead>
                    <TableHead>Mua lần đầu</TableHead>
                    <TableHead>Mua gần nhất</TableHead>
                    <TableHead className="text-right">Công nợ hiện tại</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.customers.map((c) => (
                    <TableRow key={c.customerId}>
                      <TableCell>
                        <div className="text-sm font-medium">{c.customerName}</div>
                        <div className="text-xs text-muted-foreground">{c.customerPhone}</div>
                      </TableCell>
                      <TableCell className="text-right text-sm">{c.orderCount}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatMoney(c.revenue)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(c.firstOrderAt)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(c.lastOrderAt)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatMoney(c.currentDebt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState description="Không có dữ liệu bán hàng trong kỳ đã chọn." />
          )}
        </div>
      )}
    </div>
  );
}
