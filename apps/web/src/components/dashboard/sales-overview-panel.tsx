"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { SalesOrderStatusBadge } from "@/components/sales-order/sales-order-status-badge";
import { PaymentStatusBadge } from "@/components/sales-order/payment-status-badge";
import { StatTile } from "./stat-tile";
import { DashboardCard } from "./dashboard-card";
import { DashboardRangeFilter } from "./dashboard-range-filter";
import { todayISO, endOfDayBound, Loading, ErrorState } from "@/components/shared";
import { apiGet } from "@/lib/api";

export interface SalesOverview {
  summary: {
    totalRevenue: number;
    totalPlannedCost: number;
    totalPlannedProfit: number;
    inProduction: number;
    productionCompleted: number;
    delivered: number;
  };
  recentOrders: {
    id: string;
    code: string;
    customerName: string;
    status: string;
    paymentStatus: string;
    totalAmount: number;
    createdAt: string;
  }[];
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("vi-VN").format(amount) + " ₫";
}

// Tự fetch GET /dashboard/sales (027-thiet-ke-lai-dashboard-bo-loc-rieng.md
// mục 2/6) — bộ lọc riêng, mặc định "Hôm nay", áp cả vào 6 tile (đảo ngược
// quyết định all-time cũ). Bảng "Đơn hàng gần đây" vẫn lọc client-side theo
// đúng cùng filter (giữ nguyên cách làm cũ, chỉ đổi nguồn state).
export function SalesOverviewPanel() {
  const { hasPermission } = useAuth();
  const canViewOrder = hasPermission("sales-order.view");

  const [dateFrom, setDateFrom] = useState<string | undefined>(todayISO());
  const [dateTo, setDateTo] = useState<string | undefined>(todayISO());
  const [sales, setSales] = useState<SalesOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      const json = await apiGet<SalesOverview | null>(`/dashboard/sales?${params}`);
      setSales(json);
    } catch {
      setError("Không thể tải dữ liệu Kinh doanh.");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  const filteredRecentOrders = useMemo(() => {
    if (!sales) return [];
    if (!dateFrom && !dateTo) return sales.recentOrders;
    return sales.recentOrders.filter((o) => {
      const d = new Date(o.createdAt);
      if (dateFrom && d < new Date(dateFrom)) return false;
      if (dateTo && d > endOfDayBound(dateTo)) return false;
      return true;
    });
  }, [sales, dateFrom, dateTo]);

  return (
    <DashboardCard
      title="Kinh doanh"
      actions={
        <>
          <DashboardRangeFilter
            dateFrom={dateFrom}
            dateTo={dateTo}
            onChange={(r) => {
              setDateFrom(r.from);
              setDateTo(r.to);
            }}
          />
          {canViewOrder && (
            <Button variant="outline" size="sm" render={<Link href="/orders" />}>
              Xem tất cả đơn hàng
            </Button>
          )}
        </>
      }
    >
      {loading && !sales && <Loading />}
      {error && !sales && <ErrorState description={error} onRetry={fetchSales} />}
      {!loading && !error && !sales && (
        <p className="text-sm text-muted-foreground">Không có quyền xem số liệu này.</p>
      )}

      {sales && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <StatTile label="Doanh thu kế hoạch" value={formatMoney(sales.summary.totalRevenue)} />
            <StatTile label="Giá vốn kế hoạch" value={formatMoney(sales.summary.totalPlannedCost)} />
            <StatTile label="Lợi nhuận kế hoạch" value={formatMoney(sales.summary.totalPlannedProfit)} />
            <StatTile label="Đơn đang SX" value={String(sales.summary.inProduction)} />
            <StatTile label="Đơn đã hoàn thành SX" value={String(sales.summary.productionCompleted)} />
            <StatTile label="Đã giao" value={String(sales.summary.delivered)} />
          </div>

          {filteredRecentOrders.length > 0 && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">Mã đơn</TableHead>
                    <TableHead>Khách hàng</TableHead>
                    <TableHead className="text-center">Trạng thái</TableHead>
                    <TableHead className="text-center">Thanh toán</TableHead>
                    <TableHead className="text-right">Tổng tiền</TableHead>
                    <TableHead>Ngày tạo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecentOrders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-xs font-medium">
                        {canViewOrder ? (
                          <Link href={`/orders/${o.id}`} className="text-primary underline underline-offset-2">
                            {o.code}
                          </Link>
                        ) : (
                          o.code
                        )}
                      </TableCell>
                      <TableCell>{o.customerName}</TableCell>
                      <TableCell className="text-center">
                        <SalesOrderStatusBadge status={o.status} />
                      </TableCell>
                      <TableCell className="text-center">
                        <PaymentStatusBadge status={o.paymentStatus} />
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatMoney(Number(o.totalAmount))}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(o.createdAt).toLocaleDateString("vi-VN")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </DashboardCard>
  );
}
