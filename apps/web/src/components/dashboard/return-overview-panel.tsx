import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { RETURN_REASON_LABEL } from "@/components/return/return-reason-label";
import { StatTile } from "./stat-tile";

export interface ReturnOverview {
  summary: {
    returnsThisMonth: number;
    totalProductsReturnedThisMonth: number;
    returnValueThisMonth: number;
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

export function ReturnOverviewPanel({ returns }: { returns: ReturnOverview }) {
  const { hasPermission } = useAuth();
  const canViewCustomer = hasPermission("customer.view");

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Hàng hoàn</h3>
        <Button variant="outline" size="sm" render={<Link href="/returns" />}>
          Xem tất cả hàng hoàn
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Phiếu hoàn tháng này" value={String(returns.summary.returnsThisMonth)} />
        <StatTile
          label="SL sản phẩm hoàn tháng này"
          value={new Intl.NumberFormat("vi-VN").format(returns.summary.totalProductsReturnedThisMonth)}
        />
        <StatTile label="Giá trị hoàn tháng này" value={formatMoney(returns.summary.returnValueThisMonth)} />
        <StatTile
          label="Kho thu hồi còn khả dụng"
          value={String(returns.summary.availableRecoveryCount)}
          sub={`${new Intl.NumberFormat("vi-VN").format(returns.summary.availableRecoveryQuantity)} sản phẩm`}
        />
        <StatTile
          label="Tồn kho thu hồi lâu"
          value={`${returns.aging.over30Days} / ${returns.aging.over90Days}`}
          sub="quá 30 ngày / quá 90 ngày"
          tone={returns.aging.over90Days > 0 ? "danger" : "default"}
        />
      </div>

      {returns.topReasons.length > 0 && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lý do trả hàng</TableHead>
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
          <p className="text-sm font-medium mb-3">Khách trả hàng nhiều nhất</p>
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
    </section>
  );
}
