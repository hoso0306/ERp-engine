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

export function ProductionOverviewPanel({ production }: { production: ProductionOverview }) {
  const { hasPermission } = useAuth();
  const canViewOrder = hasPermission("sales-order.view");
  const busiest = production.busyCenters[0];
  const leastBusy =
    production.busyCenters.length > 1
      ? production.busyCenters[production.busyCenters.length - 1]
      : undefined;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Sản xuất</h3>
        <Button variant="outline" size="sm" render={<Link href="/production" />}>
          Xem tất cả phiếu sản xuất
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Chờ sản xuất" value={String(production.summary.pending)} />
        <StatTile label="Đang sản xuất" value={String(production.summary.inProduction)} />
        <StatTile label="Đã hoàn thành" value={String(production.summary.completed)} />
        <StatTile label="Đã huỷ" value={String(production.summary.cancelled)} />
        <StatTile label="Tiến độ tổng" value={`${production.progress.overallProgressPercent}%`} />
      </div>

      {(busiest || leastBusy) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {busiest && (
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Xưởng bận nhất</p>
              <p className="mt-1 text-base font-medium">{busiest.productionCenterName}</p>
              <p className="text-xs text-muted-foreground">{busiest.orderCount} phiếu sản xuất</p>
            </div>
          )}
          {leastBusy && (
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Xưởng ít việc nhất</p>
              <p className="mt-1 text-base font-medium">{leastBusy.productionCenterName}</p>
              <p className="text-xs text-muted-foreground">{leastBusy.orderCount} phiếu sản xuất</p>
            </div>
          )}
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
