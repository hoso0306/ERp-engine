import Link from "next/link";
import { AlertTriangle, TrendingDown, Clock } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { EmptyState } from "@/components/shared";

interface DebtAlert {
  customerId: string;
  customerName: string;
  totalRemaining: number;
}

interface DelayedOrder {
  id: string;
  code: string;
  customerName: string;
  expectedDeliveryDate: string | null;
}

// Cảnh báo tồn kho (sắp hết/hết hàng) gỡ khỏi Dashboard cùng đợt gỡ khối Kho
// (chốt 18/07/2026, 007-bo-loc-thoi-gian-dashboard.md) — chưa triển khai báo
// cáo Kho. Còn lại luôn toàn bộ thời gian, không áp dụng bộ lọc đầu trang.
export interface AlertsData {
  overdueDebt: DebtAlert[] | null;
  creditLimitExceeded: DebtAlert[] | null;
  delayedOrders: DelayedOrder[];
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("vi-VN").format(amount) + " ₫";
}

interface AlertRow {
  key: string;
  icon: React.ReactNode;
  message: string;
  href: string | null;
}

export function AlertsPanel({ alerts }: { alerts: AlertsData }) {
  const { hasPermission } = useAuth();
  const canViewCustomer = hasPermission("customer.view");
  const canViewOrder = hasPermission("sales-order.view");

  const rows: AlertRow[] = [
    ...(alerts.overdueDebt ?? []).map((d) => ({
      key: `overdue-${d.customerId}`,
      icon: <AlertTriangle className="h-4 w-4 text-destructive" />,
      message: `${d.customerName} đang nợ quá hạn ${formatMoney(d.totalRemaining)}`,
      href: canViewCustomer ? `/customers/${d.customerId}` : null,
    })),
    ...(alerts.creditLimitExceeded ?? []).map((d) => ({
      key: `credit-${d.customerId}`,
      icon: <TrendingDown className="h-4 w-4 text-destructive" />,
      message: `${d.customerName} vượt hạn mức tín dụng (còn nợ ${formatMoney(d.totalRemaining)})`,
      href: canViewCustomer ? `/customers/${d.customerId}` : null,
    })),
    ...alerts.delayedOrders.map((o) => ({
      key: `delayed-${o.id}`,
      icon: <Clock className="h-4 w-4 text-amber-500" />,
      message: `Đơn ${o.code} (${o.customerName}) đã trễ ngày giao dự kiến${
        o.expectedDeliveryDate ? ` (${new Date(o.expectedDeliveryDate).toLocaleDateString("vi-VN")})` : ""
      }`,
      href: canViewOrder ? `/orders/${o.id}` : null,
    })),
  ];

  return (
    <section className="space-y-4">
      <h3 className="text-lg font-semibold">Cảnh báo</h3>

      {rows.length === 0 ? (
        <EmptyState title="Không có cảnh báo nào" description="Mọi thứ đang ổn." />
      ) : (
        <div className="rounded-lg border divide-y">
          {rows.map((row) => (
            <div key={row.key} className="flex items-center gap-3 px-4 py-3 text-sm">
              {row.icon}
              {row.href ? (
                <Link href={row.href} className="text-primary underline underline-offset-2">
                  {row.message}
                </Link>
              ) : (
                <span>{row.message}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
