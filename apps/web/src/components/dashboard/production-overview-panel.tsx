"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatTile } from "./stat-tile";
import { DashboardCard } from "./dashboard-card";
import { DashboardRangeFilter, rangeLabel } from "./dashboard-range-filter";
import { Loading, ErrorState } from "@/components/shared";
import { apiGet } from "@/lib/api";

export interface ProductionOverview {
  summary: {
    pending: number;
    inProduction: number;
    completed: number;
    cancelled: number;
  };
  busyCenters: {
    productionCenterId: string;
    productionCenterName: string;
    orderCount: number;
  }[];
  progress: {
    overallProgressPercent: number;
    orders: {
      salesOrderId: string;
      salesOrderCode: string;
      customerName: string;
      completed: number;
      total: number;
      progressPercent: number;
    }[];
  };
}

// Tự fetch GET /dashboard/production (027-thiet-ke-lai-dashboard-bo-loc-rieng.md
// mục 6) — bộ lọc riêng, mặc định "Tất cả". Chờ SX/Đang SX/Tiến độ tổng/Xưởng
// bận luôn tức thời, không đổi theo filter; Hoàn thành/Huỷ đổi theo filter.
export function ProductionOverviewPanel() {
  const { hasPermission } = useAuth();
  const canViewOrder = hasPermission("sales-order.view");

  const [dateFrom, setDateFrom] = useState<string | undefined>(undefined);
  const [dateTo, setDateTo] = useState<string | undefined>(undefined);
  const [production, setProduction] = useState<ProductionOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProduction = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      const json = await apiGet<ProductionOverview | null>(`/dashboard/production?${params}`);
      setProduction(json);
    } catch {
      setError("Không thể tải dữ liệu Sản xuất.");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchProduction();
  }, [fetchProduction]);

  const label = rangeLabel(dateFrom, dateTo);
  const sortedCenters = production
    ? [...production.busyCenters].sort((a, b) => b.orderCount - a.orderCount)
    : [];

  return (
    <DashboardCard
      title="Sản xuất"
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
          <Button variant="outline" size="sm" render={<Link href="/production" />}>
            Xem tất cả phiếu sản xuất
          </Button>
        </>
      }
    >
      {loading && !production && <Loading />}
      {error && !production && <ErrorState description={error} onRetry={fetchProduction} />}
      {!loading && !error && !production && (
        <p className="text-sm text-muted-foreground">Không có quyền xem số liệu này.</p>
      )}

      {production && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <StatTile
              label="Chờ sản xuất"
              value={String(production.summary.pending)}
              sub="phiếu SX, hiện tại"
              href="/production?status=PENDING"
            />
            <StatTile
              label="Đang sản xuất"
              value={String(production.summary.inProduction)}
              sub="phiếu SX, hiện tại"
              href="/production?status=IN_PRODUCTION"
            />
            <StatTile label="Đã hoàn thành" value={String(production.summary.completed)} sub={`phiếu SX, ${label}`} />
            <StatTile
              label="Đã huỷ"
              value={String(production.summary.cancelled)}
              sub={`phiếu SX, ${label}`}
              href={`/production?status=CANCELLED${dateFrom ? `&from=${dateFrom}` : ""}${dateTo ? `&to=${dateTo}` : ""}`}
            />
            <StatTile label="Tiến độ tổng" value={`${production.progress.overallProgressPercent}%`} sub="hiện tại" />
          </div>

          {sortedCenters.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Xưởng sản xuất (hiện tại)</p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {sortedCenters.map((c, idx) => (
                  <StatTile
                    key={c.productionCenterId}
                    label={c.productionCenterName}
                    value={String(c.orderCount)}
                    sub={
                      idx === 0 && sortedCenters.length > 1
                        ? "phiếu — bận nhất"
                        : idx === sortedCenters.length - 1 && sortedCenters.length > 1
                          ? "phiếu — ít việc nhất"
                          : "phiếu đang xử lý"
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {production.progress.orders.length > 0 && (
            // Chỉ hiện ~4 dòng, còn lại cuộn trong chính khung bảng (không phân
            // trang/không nút "xem thêm") — header đứng yên (sticky) khi cuộn.
            <div className="rounded-md border max-h-[220px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead className="w-32">Mã đơn</TableHead>
                    <TableHead>Khách hàng</TableHead>
                    <TableHead className="text-center">Tiến độ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {production.progress.orders.map((o) => (
                    <TableRow key={o.salesOrderId}>
                      <TableCell className="font-mono text-xs font-medium">
                        {canViewOrder ? (
                          <Link href={`/orders/${o.salesOrderId}`} className="text-primary underline underline-offset-2">
                            {o.salesOrderCode}
                          </Link>
                        ) : (
                          o.salesOrderCode
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{o.customerName}</TableCell>
                      <TableCell className="text-center text-sm">
                        {o.completed}/{o.total} ({o.progressPercent}%)
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
