"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DashboardCard } from "./dashboard-card";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import { Loading, ErrorState } from "@/components/shared";
import { apiGet } from "@/lib/api";

interface EmployeeRevenueRow {
  ownerId: string | null;
  ownerName: string | null;
  orderCount: number;
  revenue: number;
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

// Khối "Doanh số theo nhân viên" (rà soát nghiệp vụ Return, 27/08/2026) —
// đặt ngay dưới khối Kinh doanh. Bộ lọc riêng, mặc định "Tháng này" (khác
// mặc định "Hôm nay" của khối Kinh doanh) — dùng DateRangeFilter dùng chung
// toàn hệ thống (có preset Tháng này), KHÔNG dùng DashboardRangeFilter (chỉ
// có 4 preset ngắn, không có Tháng này — xem dashboard-range-filter.tsx).
// Chỉ hiện nhân viên có phát sinh doanh số trong khoảng lọc (BE tự loại trừ).
export function EmployeeRevenuePanel() {
  const { hasPermission } = useAuth();
  const canView = hasPermission("sales-order.view-cost");

  const initial = presetRangeThisMonth();
  const [dateFrom, setDateFrom] = useState(initial.from);
  const [dateTo, setDateTo] = useState(initial.to);
  const [rows, setRows] = useState<EmployeeRevenueRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!dateFrom || !dateTo) {
      setRows(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from: dateFrom, to: dateTo });
      const json = await apiGet<EmployeeRevenueRow[] | null>(`/dashboard/sales/by-employee?${params}`);
      setRows(json);
    } catch {
      setError("Không thể tải dữ liệu Doanh số theo nhân viên.");
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
      title="Doanh số theo nhân viên"
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
      ) : loading && !rows ? (
        <Loading />
      ) : error ? (
        <ErrorState description={error} onRetry={fetchData} />
      ) : !rows || rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có nhân viên nào phát sinh doanh số trong khoảng này.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nhân viên</TableHead>
                <TableHead className="text-right">Số đơn</TableHead>
                <TableHead className="text-right">Doanh số (đã trừ hoàn)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.ownerId ?? "unknown"}>
                  <TableCell>{r.ownerName ?? "Không xác định"}</TableCell>
                  <TableCell className="text-right text-sm">{r.orderCount}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{formatMoney(r.revenue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </DashboardCard>
  );
}
