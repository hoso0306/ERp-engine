import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatTile } from "./stat-tile";

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
      completed: number;
      total: number;
      progressPercent: number;
    }[];
  };
}

function formatDMY(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// Rà soát bộ lọc thời gian Dashboard (chốt 18/07/2026,
// 007-bo-loc-thoi-gian-dashboard.md) — dùng chung cách hiển thị khoảng ngày
// với ReturnOverviewPanel.
function rangeLabel(dateFrom?: string, dateTo?: string): string {
  if (!dateFrom && !dateTo) return "toàn bộ thời gian";
  if (dateFrom && dateTo && dateFrom === dateTo) return formatDMY(dateFrom);
  if (dateFrom && dateTo) return `${formatDMY(dateFrom)} - ${formatDMY(dateTo)}`;
  if (dateFrom) return `từ ${formatDMY(dateFrom)}`;
  return `đến ${formatDMY(dateTo!)}`;
}

interface ProductionOverviewPanelProps {
  production: ProductionOverview;
  dateFrom?: string;
  dateTo?: string;
}

export function ProductionOverviewPanel({ production, dateFrom, dateTo }: ProductionOverviewPanelProps) {
  const { hasPermission } = useAuth();
  const canViewOrder = hasPermission("sales-order.view");
  const label = rangeLabel(dateFrom, dateTo);
  const sortedCenters = [...production.busyCenters].sort((a, b) => b.orderCount - a.orderCount);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Sản xuất</h3>
        <Button variant="outline" size="sm" render={<Link href="/production" />}>
          Xem tất cả phiếu sản xuất
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Chờ sản xuất" value={String(production.summary.pending)} sub="hiện tại" />
        <StatTile label="Đang sản xuất" value={String(production.summary.inProduction)} sub="hiện tại" />
        <StatTile label="Đã hoàn thành" value={String(production.summary.completed)} sub={label} />
        <StatTile label="Đã huỷ" value={String(production.summary.cancelled)} sub={label} />
        <StatTile label="Tiến độ tổng" value={`${production.progress.overallProgressPercent}%`} sub="hiện tại" />
      </div>

      {sortedCenters.length > 0 && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Xưởng sản xuất (hiện tại)</TableHead>
                <TableHead className="text-right">Số phiếu đang xử lý</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedCenters.map((c, idx) => (
                <TableRow key={c.productionCenterId}>
                  <TableCell className="text-sm">
                    {c.productionCenterName}
                    {idx === 0 && sortedCenters.length > 1 && (
                      <span className="ml-2 text-xs text-muted-foreground">(bận nhất)</span>
                    )}
                    {idx === sortedCenters.length - 1 && sortedCenters.length > 1 && (
                      <span className="ml-2 text-xs text-muted-foreground">(ít việc nhất)</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm font-mono">{c.orderCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {production.progress.orders.length > 0 && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Mã đơn</TableHead>
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
                  <TableCell className="text-center text-sm">
                    {o.completed}/{o.total} ({o.progressPercent}%)
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
