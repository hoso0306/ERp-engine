import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { RETURN_REASON_LABEL } from "@/components/return/return-reason-label";
import { StatTile } from "./stat-tile";

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

function formatDMY(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// Rà soát bộ lọc thời gian Dashboard (chốt 18/07/2026,
// 007-bo-loc-thoi-gian-dashboard.md): nhãn khoảng ngày mô tả đúng dữ liệu
// backend đã lọc — thay cho "...tháng này" hard-code trước đây.
function rangeLabel(dateFrom?: string, dateTo?: string): string {
  if (!dateFrom && !dateTo) return "Toàn bộ thời gian";
  if (dateFrom && dateTo && dateFrom === dateTo) return `Ngày ${formatDMY(dateFrom)}`;
  if (dateFrom && dateTo) return `${formatDMY(dateFrom)} - ${formatDMY(dateTo)}`;
  if (dateFrom) return `Từ ${formatDMY(dateFrom)}`;
  return `Đến ${formatDMY(dateTo!)}`;
}

interface ReturnOverviewPanelProps {
  returns: ReturnOverview;
  dateFrom?: string;
  dateTo?: string;
}

export function ReturnOverviewPanel({ returns, dateFrom, dateTo }: ReturnOverviewPanelProps) {
  const { hasPermission } = useAuth();
  const canViewCustomer = hasPermission("customer.view");
  const label = rangeLabel(dateFrom, dateTo);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Hàng hoàn</h3>
        <Button variant="outline" size="sm" render={<Link href="/returns" />}>
          Xem tất cả hàng hoàn
        </Button>
      </div>

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
    </section>
  );
}
