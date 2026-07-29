"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { RETURN_REASON_LABEL } from "@/components/return/return-reason-label";
import { StatTile } from "./stat-tile";
import { DashboardCard } from "./dashboard-card";
import { DashboardRangeFilter, rangeLabel } from "./dashboard-range-filter";
import { Loading, ErrorState } from "@/components/shared";
import { apiGet } from "@/lib/api";

export interface ReturnOverview {
  summary: {
    returnsInRange: number;
    totalProductsReturnedInRange: number;
    returnValueInRange: number;
    availableRecoveryCount: number;
    availableRecoveryQuantity: number;
  };
  aging: {
    over30Days: number;
    over90Days: number;
  };
  topReasons: {
    reason: string;
    count: number;
    returnedQuantity: number;
    percent: number;
  }[];
  byCustomer: {
    customerId: string;
    customerName: string;
    returnCount: number;
  }[];
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("vi-VN").format(amount) + " ₫";
}

// Tự fetch GET /dashboard/returns (027-thiet-ke-lai-dashboard-bo-loc-rieng.md
// mục 7) — bộ lọc riêng, mặc định "Tất cả". Kho thu hồi khả dụng/Tồn kho thu
// hồi lâu luôn tức thời; Phiếu hoàn/SL/Giá trị hoàn + bảng Lý do/Khách trả
// nhiều đổi theo filter riêng của khối.
export function ReturnOverviewPanel() {
  const { hasPermission } = useAuth();
  const canViewCustomer = hasPermission("customer.view");

  const [dateFrom, setDateFrom] = useState<string | undefined>(undefined);
  const [dateTo, setDateTo] = useState<string | undefined>(undefined);
  const [returns, setReturns] = useState<ReturnOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      const json = await apiGet<ReturnOverview | null>(`/dashboard/returns?${params}`);
      setReturns(json);
    } catch {
      setError("Không thể tải dữ liệu Hàng hoàn.");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  const label = rangeLabel(dateFrom, dateTo);

  return (
    <DashboardCard
      title="Hàng hoàn"
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
          <Button variant="outline" size="sm" render={<Link href="/returns" />}>
            Xem tất cả hàng hoàn
          </Button>
        </>
      }
    >
      {loading && !returns && <Loading />}
      {error && !returns && <ErrorState description={error} onRetry={fetchReturns} />}
      {!loading && !error && !returns && (
        <p className="text-sm text-muted-foreground">Không có quyền xem số liệu này.</p>
      )}

      {returns && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <StatTile label="Phiếu hoàn" value={String(returns.summary.returnsInRange)} sub={label} />
            <StatTile
              label="SL sản phẩm hoàn"
              value={new Intl.NumberFormat("vi-VN").format(returns.summary.totalProductsReturnedInRange)}
              sub={label}
            />
            <StatTile
              label="Giá trị hoàn"
              value={formatMoney(returns.summary.returnValueInRange)}
              sub={label}
            />
            <StatTile
              label="Kho thu hồi còn khả dụng"
              value={String(returns.summary.availableRecoveryCount)}
              sub={`${new Intl.NumberFormat("vi-VN").format(returns.summary.availableRecoveryQuantity)} sản phẩm — hiện tại`}
            />
            <StatTile
              label="Tồn kho thu hồi lâu"
              value={`${returns.aging.over30Days} / ${returns.aging.over90Days}`}
              sub="quá 30 ngày / quá 90 ngày — hiện tại"
              tone={returns.aging.over90Days > 0 ? "danger" : "default"}
              href="/returns?tab=recovery&status=AVAILABLE&sort=created_asc"
            />
          </div>

          {returns.topReasons.length > 0 && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lý do trả hàng ({label})</TableHead>
                    <TableHead className="text-right">Số phiếu</TableHead>
                    <TableHead className="text-right">SL trả</TableHead>
                    <TableHead className="text-right">Tỷ lệ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {returns.topReasons.map((r) => (
                    <TableRow key={r.reason}>
                      <TableCell>{RETURN_REASON_LABEL[r.reason] ?? r.reason}</TableCell>
                      <TableCell className="text-right text-sm">{r.count}</TableCell>
                      <TableCell className="text-right text-sm">
                        {new Intl.NumberFormat("vi-VN").format(r.returnedQuantity)}
                      </TableCell>
                      <TableCell className="text-right text-sm">{r.percent}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {returns.byCustomer.length > 0 && (
            <div className="rounded-lg border p-4">
              <p className="text-sm font-medium mb-3">Khách trả hàng nhiều nhất ({label})</p>
              <ol className="space-y-2">
                {returns.byCustomer.map((c, idx) => (
                  <li key={c.customerId} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="text-muted-foreground w-5 text-right">{idx + 1}.</span>
                      {canViewCustomer ? (
                        <Link href={`/customers/${c.customerId}`} className="font-medium text-primary underline underline-offset-2">
                          {c.customerName}
                        </Link>
                      ) : (
                        <span className="font-medium">{c.customerName}</span>
                      )}
                    </span>
                    <span className="font-mono">{c.returnCount} phiếu</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}
    </DashboardCard>
  );
}
