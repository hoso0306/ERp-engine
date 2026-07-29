"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, TrendingDown, Clock } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { EmptyState, Loading, ErrorState } from "@/components/shared";
import { apiGet } from "@/lib/api";
import { DashboardCard } from "./dashboard-card";
import { AlertGroup } from "./alert-group";

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

interface PendingQuotation {
  id: string;
  code: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  sentAt: string;
}

interface OverdueProductionOrder {
  id: string;
  code: string;
  productionCenterName: string;
  createdAt: string;
  salesOrder: { id: string; code: string; customerName: string };
}

// Cảnh báo tồn kho (sắp hết/hết hàng) gỡ khỏi Dashboard cùng đợt gỡ khối Kho
// (chốt 18/07/2026, 007-bo-loc-thoi-gian-dashboard.md) — chưa triển khai báo
// cáo Kho. Còn lại luôn toàn bộ thời gian, không có bộ lọc (khối Cảnh báo
// không nằm trong danh sách 5 khối có filter riêng — 027-thiet-ke-lai-
// dashboard-bo-loc-rieng.md).
export interface AlertsData {
  overdueDebt: DebtAlert[] | null;
  creditLimitExceeded: DebtAlert[] | null;
  delayedOrders: DelayedOrder[] | null;
  pendingQuotations: PendingQuotation[] | null;
  overdueProductionOrders: OverdueProductionOrder[] | null;
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("vi-VN").format(amount) + " ₫";
}

function AlertRow({ message, href }: { message: string; href: string | null }) {
  return (
    <div className="px-4 py-3 text-sm">
      {href ? (
        <Link href={href} className="text-primary underline underline-offset-2">
          {message}
        </Link>
      ) : (
        <span>{message}</span>
      )}
    </div>
  );
}

// Tự fetch GET /dashboard/alerts (027-thiet-ke-lai-dashboard-bo-loc-rieng.md
// — mỗi khối/panel giờ tự chủ, không nhận data qua props từ dashboard/page.tsx
// nữa). Gom theo 5 nhóm dạng accordion (mục 1) — bấm mới xổ, có số lượng bên
// cạnh; nhóm 0 cảnh báo tự ẩn (AlertGroup xử lý).
export function AlertsPanel() {
  const { hasPermission } = useAuth();
  const canViewCustomer = hasPermission("customer.view");
  const canViewOrder = hasPermission("sales-order.view");
  const canViewQuotation = hasPermission("quotation.view");
  const canViewProduction = hasPermission("production.view");

  const [alerts, setAlerts] = useState<AlertsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await apiGet<AlertsData>("/dashboard/alerts");
      setAlerts(json);
    } catch {
      setError("Không thể tải cảnh báo.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const overdueDebt = alerts?.overdueDebt ?? [];
  const creditLimitExceeded = alerts?.creditLimitExceeded ?? [];
  const delayedOrders = alerts?.delayedOrders ?? [];
  const pendingQuotations = alerts?.pendingQuotations ?? [];
  const overdueProductionOrders = alerts?.overdueProductionOrders ?? [];
  const totalCount =
    overdueDebt.length +
    creditLimitExceeded.length +
    delayedOrders.length +
    pendingQuotations.length +
    overdueProductionOrders.length;

  return (
    <DashboardCard title="Cảnh báo" accent="warning">
      {loading && !alerts && <Loading />}
      {error && !alerts && <ErrorState description={error} onRetry={fetchAlerts} />}
      {alerts && totalCount === 0 && (
        <EmptyState title="Không có cảnh báo nào" description="Mọi thứ đang ổn." />
      )}
      {alerts && totalCount > 0 && (
        <div className="space-y-2">
          <AlertGroup
            icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
            label="Khách nợ quá hạn"
            count={overdueDebt.length}
            tone="danger"
          >
            {overdueDebt.map((d) => (
              <AlertRow
                key={d.customerId}
                message={`${d.customerName} đang nợ quá hạn ${formatMoney(d.totalRemaining)}`}
                href={canViewCustomer ? `/customers/${d.customerId}` : null}
              />
            ))}
          </AlertGroup>

          <AlertGroup
            icon={<TrendingDown className="h-4 w-4 text-destructive" />}
            label="Khách vượt hạn mức"
            count={creditLimitExceeded.length}
            tone="danger"
          >
            {creditLimitExceeded.map((d) => (
              <AlertRow
                key={d.customerId}
                message={`${d.customerName} vượt hạn mức tín dụng (còn nợ ${formatMoney(d.totalRemaining)})`}
                href={canViewCustomer ? `/customers/${d.customerId}` : null}
              />
            ))}
          </AlertGroup>

          <AlertGroup
            icon={<Clock className="h-4 w-4 text-amber-500" />}
            label="Đơn trễ giao"
            count={delayedOrders.length}
          >
            {delayedOrders.map((o) => (
              <AlertRow
                key={o.id}
                message={`Đơn ${o.code} (${o.customerName}) đã trễ ngày giao dự kiến${
                  o.expectedDeliveryDate
                    ? ` (${new Date(o.expectedDeliveryDate).toLocaleDateString("vi-VN")})`
                    : ""
                }`}
                href={canViewOrder ? `/orders/${o.id}` : null}
              />
            ))}
          </AlertGroup>

          <AlertGroup
            icon={<Clock className="h-4 w-4 text-amber-500" />}
            label="Báo giá chưa phản hồi"
            count={pendingQuotations.length}
          >
            {pendingQuotations.map((q) => (
              <AlertRow
                key={q.id}
                message={`Báo giá ${q.code} (${q.customerName}) đã gửi ngày ${new Date(q.sentAt).toLocaleDateString("vi-VN")} chưa có phản hồi`}
                href={canViewQuotation ? `/quotations/${q.id}` : null}
              />
            ))}
          </AlertGroup>

          <AlertGroup
            icon={<Clock className="h-4 w-4 text-amber-500" />}
            label="Phiếu SX trễ hạn"
            count={overdueProductionOrders.length}
          >
            {overdueProductionOrders.map((p) => (
              <AlertRow
                key={p.id}
                message={`Phiếu SX ${p.code} (${p.salesOrder.customerName}, ${p.productionCenterName}) trễ hạn sản xuất`}
                href={canViewProduction ? `/production/${p.id}` : null}
              />
            ))}
          </AlertGroup>
        </div>
      )}
    </DashboardCard>
  );
}
