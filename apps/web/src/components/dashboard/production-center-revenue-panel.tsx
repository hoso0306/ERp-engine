"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DashboardCard } from "./dashboard-card";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import { Loading, ErrorState } from "@/components/shared";
import { apiGet } from "@/lib/api";

interface CenterRevenueRow {
  productionCenterId: string | null;
  productionCenterName: string | null;
  orderCount: number;
  revenue: number;
  revenuePercent: number;
}

interface CenterRevenueResponse {
  totalRevenue: number;
  centers: CenterRevenueRow[];
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("vi-VN").format(amount) + " ₫";
}

function presetRangeThisMonth(): { from: string; to: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: iso(start), to: iso(end) };
}

// Khối "Doanh số theo xưởng" (sprint-04/028) — cùng cơ chế với khối "Doanh
// số theo nhân viên": bộ lọc riêng, mặc định "Tháng này". Số liệu GROSS
// (SUM thành tiền dòng đơn hàng, chưa trừ hàng hoàn) — khác khối theo nhân
// viên vốn đã trừ hoàn, nên ghi rõ nhãn để không lẫn. Dòng không có xưởng =
// bán lẻ vật tư (không qua sản xuất).
export function ProductionCenterRevenuePanel() {
  const { hasPermission } = useAuth();
  const canView = hasPermission("sales-order.view-cost");

  const initial = presetRangeThisMonth();
  const [dateFrom, setDateFrom] = useState(initial.from);
  const [dateTo, setDateTo] = useState(initial.to);
  const [data, setData] = useState<CenterRevenueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!dateFrom || !dateTo) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from: dateFrom, to: dateTo });
      const json = await apiGet<CenterRevenueResponse | null>(`/dashboard/sales/by-production-center?${params}`);
      setData(json);
    } catch {
      setError("Không thể tải dữ liệu Doanh số theo xưởng.");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!canView) return null;

  return (
    <DashboardCard
      title="Doanh số theo xưởng"
      actions={
        <DateRangeFilter
          dateFrom={dateFrom}
          onDateFromChange={setDateFrom}
          dateTo={dateTo}
          onDateToChange={setDateTo}
        />
      }
    >
      {!dateFrom || !dateTo ? (
        <p className="text-sm text-muted-foreground">Vui lòng chọn khoảng thời gian cụ thể để xem doanh số.</p>
      ) : loading && !data ? (
        <Loading />
      ) : error ? (
        <ErrorState description={error} onRetry={fetchData} />
      ) : !data || data.centers.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có doanh số trong khoảng này.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Xưởng</TableHead>
                <TableHead className="text-right">Số đơn</TableHead>
                <TableHead className="text-right">Doanh số (chưa trừ hoàn)</TableHead>
                <TableHead className="text-right">Tỷ trọng</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.centers.map((c) => (
                <TableRow key={c.productionCenterId ?? "retail"}>
                  <TableCell>
                    {c.productionCenterId ? (
                      <Link href={`/reports/production-centers/${c.productionCenterId}`} className="text-primary hover:underline">
                        {c.productionCenterName ?? "—"}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Bán lẻ vật tư</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm">{c.orderCount}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{formatMoney(c.revenue)}</TableCell>
                  <TableCell className="text-right text-sm">{c.revenuePercent.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell className="font-medium">Tổng</TableCell>
                <TableCell />
                <TableCell className="text-right font-mono text-sm font-medium">{formatMoney(data.totalRevenue)}</TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </DashboardCard>
  );
}
