"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatTile } from "./stat-tile";
import { DashboardCard } from "./dashboard-card";
import { DashboardRangeFilter } from "./dashboard-range-filter";
import { Loading, ErrorState } from "@/components/shared";
import { apiGet } from "@/lib/api";

interface Receivable {
  id: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate: string | null;
  salesOrder: {
    id: string;
    code: string;
    customerName: string;
    customerPhone: string;
  };
}

interface Debtor {
  customerId: string;
  customerName: string;
  customerPhone?: string;
  totalRemaining: number;
}

export interface DebtOverview {
  summary: {
    totalReceivable: number;
    totalPaid: number;
    totalRemaining: number;
    overdueAmount: number;
    overdueCount: number;
  };
  upcomingDue: Receivable[];
  creditExceeded: { customerId: string; customerName: string; totalRemaining: number; debtLimit: number }[];
  topDebtors: Debtor[];
  // "Phát sinh trong kỳ" (027-thiet-ke-lai-dashboard-bo-loc-rieng.md mục 4) —
  // null khi bộ lọc riêng của khối chọn "Tất cả" (không đủ 2 mốc from/to cụ
  // thể để tính theo kỳ). Các field số dư phía trên KHÔNG đổi theo filter.
  inRange: {
    newReceivableCount: number;
    newReceivableAmount: number;
    cashIn: { totalCashIn: number; paymentCount: number };
  } | null;
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("vi-VN").format(amount) + " ₫";
}

// Tự fetch GET /dashboard/debt (027-thiet-ke-lai-dashboard-bo-loc-rieng.md
// mục 3-4) — bộ lọc riêng, mặc định "Tất cả". Các tile số dư (Tổng phải
// thu/Đã thu/Còn phải thu/Quá hạn/Vượt hạn mức/Top khách nợ) luôn all-time,
// KHÔNG đổi theo filter (đúng nguyên tắc report.md — công nợ là số dư, không
// phải số phát sinh theo kỳ). Filter chỉ ảnh hưởng 2 tile "phát sinh" mới.
export function DebtOverviewPanel() {
  const { hasPermission } = useAuth();
  const canViewDebt = hasPermission("debt.view");
  const canViewCustomer = hasPermission("customer.view");

  const [dateFrom, setDateFrom] = useState<string | undefined>(undefined);
  const [dateTo, setDateTo] = useState<string | undefined>(undefined);
  const [debt, setDebt] = useState<DebtOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDebt = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      const json = await apiGet<DebtOverview | null>(`/dashboard/debt?${params}`);
      setDebt(json);
    } catch {
      setError("Không thể tải dữ liệu Công nợ.");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchDebt();
  }, [fetchDebt]);

  const creditExceededTotal = debt?.creditExceeded.reduce((s, c) => s + c.totalRemaining, 0) ?? 0;

  return (
    <DashboardCard
      title="Tổng công nợ"
      description="Các tile số dư luôn tính toàn bộ thời gian — bộ lọc chỉ ảnh hưởng phần phát sinh trong kỳ"
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
          <Button variant="outline" size="sm" render={<Link href="/debts/by-customer" />}>
            Xem tất cả công nợ
          </Button>
        </>
      }
    >
      {loading && !debt && <Loading />}
      {error && !debt && <ErrorState description={error} onRetry={fetchDebt} />}
      {!loading && !error && !debt && (
        <p className="text-sm text-muted-foreground">Không có quyền xem số liệu này.</p>
      )}

      {debt && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <StatTile label="Tổng phải thu" value={formatMoney(debt.summary.totalReceivable)} />
            <StatTile label="Đã thu" value={formatMoney(debt.summary.totalPaid)} />
            <StatTile label="Còn phải thu" value={formatMoney(debt.summary.totalRemaining)} />
            <StatTile
              label="Quá hạn"
              value={formatMoney(debt.summary.overdueAmount)}
              sub={`${debt.summary.overdueCount} phiếu`}
              tone={debt.summary.overdueCount > 0 ? "danger" : "default"}
              href="/debts/by-customer?filter=overdue"
            />
            <StatTile
              label="Vượt hạn mức"
              value={formatMoney(creditExceededTotal)}
              sub={`${debt.creditExceeded.length} khách hàng`}
              tone={debt.creditExceeded.length > 0 ? "danger" : "default"}
              href="/debts/by-customer?filter=creditExceeded"
            />
            {debt.inRange && (
              <>
                <StatTile
                  label="Nợ mới phát sinh"
                  value={formatMoney(debt.inRange.newReceivableAmount)}
                  sub={`${debt.inRange.newReceivableCount} phiếu — trong kỳ`}
                />
                <StatTile
                  label="Tiền đã thu"
                  value={formatMoney(debt.inRange.cashIn.totalCashIn)}
                  sub={`${debt.inRange.cashIn.paymentCount} phiếu thu — trong kỳ`}
                />
              </>
            )}
          </div>

          {debt.upcomingDue.length > 0 && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sắp đến hạn</TableHead>
                    <TableHead>Khách hàng</TableHead>
                    <TableHead>Hạn thanh toán</TableHead>
                    <TableHead className="text-right">Còn lại</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {debt.upcomingDue.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs font-medium">
                        {canViewDebt ? (
                          <Link href={`/debts/${r.id}`} className="text-primary underline underline-offset-2">
                            {r.salesOrder.code}
                          </Link>
                        ) : (
                          r.salesOrder.code
                        )}
                      </TableCell>
                      <TableCell>{r.salesOrder.customerName}</TableCell>
                      <TableCell className="text-sm">
                        {r.dueDate ? new Date(r.dueDate).toLocaleDateString("vi-VN") : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatMoney(r.remainingAmount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {debt.topDebtors.length > 0 && (
            <div className="rounded-lg border p-4">
              <p className="text-sm font-medium mb-3">Top khách nợ nhiều nhất</p>
              <ol className="space-y-2">
                {debt.topDebtors.map((d, idx) => (
                  <li key={d.customerId} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="text-muted-foreground w-5 text-right">{idx + 1}.</span>
                      {canViewCustomer ? (
                        <Link href={`/customers/${d.customerId}`} className="font-medium text-primary underline underline-offset-2">
                          {d.customerName}
                        </Link>
                      ) : (
                        <span className="font-medium">{d.customerName}</span>
                      )}
                      {d.customerPhone && <span className="text-xs text-muted-foreground">{d.customerPhone}</span>}
                    </span>
                    <span className="font-mono text-destructive">{formatMoney(d.totalRemaining)}</span>
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
