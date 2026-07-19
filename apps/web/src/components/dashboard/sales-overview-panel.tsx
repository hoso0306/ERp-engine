import { useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { SalesOrderStatusBadge } from "@/components/sales-order/sales-order-status-badge";
import { PaymentStatusBadge } from "@/components/sales-order/payment-status-badge";
import { StatTile } from "./stat-tile";
import { endOfDayBound } from "@/components/shared";

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

interface SalesOverviewPanelProps {
  sales: SalesOverview;
  dateFrom?: string;
  dateTo?: string;
}

export function SalesOverviewPanel({ sales, dateFrom, dateTo }: SalesOverviewPanelProps) {
  const { hasPermission } = useAuth();
  const canViewOrder = hasPermission("sales-order.view");

  // KPI tổng quan (summary) luôn phản ánh hiện trạng thật, không lọc theo
  // thời gian — chỉ danh sách "Đơn hàng gần đây" được lọc theo khoảng ngày tạo
  // đã chọn (thiết kế chốt: bộ lọc Dashboard chỉ ảnh hưởng danh sách con).
  const filteredRecentOrders = useMemo(() => {
    if (!dateFrom && !dateTo) return sales.recentOrders;
    return sales.recentOrders.filter((o) => {
      const d = new Date(o.createdAt);
      if (dateFrom && d < new Date(dateFrom)) return false;
      if (dateTo && d > endOfDayBound(dateTo)) return false;
      return true;
    });
  }, [sales.recentOrders, dateFrom, dateTo]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Kinh doanh</h3>
        {canViewOrder && (
          <Button variant="outline" size="sm" render={<Link href="/orders" />}>
            Xem tất cả đơn hàng
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Doanh thu kế hoạch" value={formatMoney(sales.summary.totalRevenue)} />
        <StatTile label="Giá vốn kế hoạch" value={formatMoney(sales.summary.totalPlannedCost)} />
        <StatTile label="Lợi nhuận kế hoạch" value={formatMoney(sales.summary.totalPlannedProfit)} />
        <StatTile label="Đang sản xuất" value={String(sales.summary.inProduction)} />
        <StatTile label="Hoàn thành SX" value={String(sales.summary.productionCompleted)} />
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
    </section>
  );
}
