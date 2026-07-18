import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatTile } from "./stat-tile";

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
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("vi-VN").format(amount) + " ₫";
}

interface DebtOverviewPanelProps {
  debt: DebtOverview;
}

// Rà soát bộ lọc thời gian Dashboard (chốt 18/07/2026,
// 007-bo-loc-thoi-gian-dashboard.md): "Tổng công nợ" luôn tính toàn bộ thời
// gian — KHÔNG áp dụng bộ lọc đầu trang Dashboard (khác Kinh doanh/Sản
// xuất/Hàng hoàn). Công nợ là số dư luỹ kế, không phải số phát sinh theo kỳ.
export function DebtOverviewPanel({ debt }: DebtOverviewPanelProps) {
  const { hasPermission } = useAuth();
  const canViewDebt = hasPermission("debt.view");
  const canViewCustomer = hasPermission("customer.view");

  const creditExceededTotal = debt.creditExceeded.reduce((s, c) => s + c.totalRemaining, 0);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Tổng công nợ</h3>
          <p className="text-xs text-muted-foreground">(toàn bộ thời gian — không áp dụng bộ lọc)</p>
        </div>
        <Button variant="outline" size="sm" render={<Link href="/debts" />}>
          Xem tất cả công nợ
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Tổng phải thu" value={formatMoney(debt.summary.totalReceivable)} />
        <StatTile label="Đã thu" value={formatMoney(debt.summary.totalPaid)} />
        <StatTile label="Còn phải thu" value={formatMoney(debt.summary.totalRemaining)} />
        <StatTile
          label="Quá hạn"
          value={formatMoney(debt.summary.overdueAmount)}
          sub={`${debt.summary.overdueCount} phiếu`}
          tone={debt.summary.overdueCount > 0 ? "danger" : "default"}
        />
        <StatTile
          label="Vượt hạn mức"
          value={formatMoney(creditExceededTotal)}
          sub={`${debt.creditExceeded.length} khách hàng`}
          tone={debt.creditExceeded.length > 0 ? "danger" : "default"}
        />
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
    </section>
  );
}
