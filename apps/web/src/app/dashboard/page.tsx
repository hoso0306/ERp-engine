"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { PageHeader, Loading, ErrorState, todayISO } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/api";
import { DashboardRangeFilter } from "@/components/dashboard/dashboard-range-filter";
import { SalesOverviewPanel, type SalesOverview } from "@/components/dashboard/sales-overview-panel";
import { ProductionOverviewPanel, type ProductionOverview } from "@/components/dashboard/production-overview-panel";
import { DebtOverviewPanel, type DebtOverview } from "@/components/dashboard/debt-overview-panel";
import { ReturnOverviewPanel, type ReturnOverview } from "@/components/dashboard/return-overview-panel";
import { AlertsPanel, type AlertsData } from "@/components/dashboard/alerts-panel";

// Field permission-gated (production/debt/returns) trả về null nếu user
// thiếu quyền view tương ứng — xem apps/api/src/dashboard/dashboard.controller.ts.
// `sales` và `alerts.delayedOrders` hiện không bị ẩn theo quyền (ghi nhận, không tự sửa BE).
// Khối Kho đã gỡ khỏi Dashboard (chốt 18/07/2026,
// 007-bo-loc-thoi-gian-dashboard.md) — chưa triển khai báo cáo Kho.
interface DashboardOverview {
  sales: SalesOverview;
  production: ProductionOverview | null;
  debt: DebtOverview | null;
  returns: ReturnOverview | null;
  alerts: AlertsData;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Mặc định "Hôm nay" (rà soát bộ lọc, chốt 18/07/2026).
  const [dateFrom, setDateFrom] = useState(todayISO());
  const [dateTo, setDateTo] = useState(todayISO());

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      const json = await apiGet<DashboardOverview>(`/dashboard/overview?${params}`);
      setData(json);
    } catch {
      setError("Không thể tải dữ liệu dashboard.");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Tổng quan tình hình kinh doanh, sản xuất và công nợ"
        actions={
          <div className="flex items-center gap-2">
            <DashboardRangeFilter
              dateFrom={dateFrom}
              dateTo={dateTo}
              onChange={(range) => {
                setDateFrom(range.from);
                setDateTo(range.to);
              }}
            />
            <Button variant="outline" size="sm" onClick={fetchOverview} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Làm mới
            </Button>
          </div>
        }
      />

      {loading && !data && <Loading />}
      {error && !data && <ErrorState description={error} onRetry={fetchOverview} />}

      {data && (
        <div className="space-y-8">
          <SalesOverviewPanel sales={data.sales} dateFrom={dateFrom} dateTo={dateTo} />
          {data.production && (
            <ProductionOverviewPanel production={data.production} dateFrom={dateFrom} dateTo={dateTo} />
          )}
          {data.debt && <DebtOverviewPanel debt={data.debt} />}
          {data.returns && (
            <ReturnOverviewPanel returns={data.returns} dateFrom={dateFrom} dateTo={dateTo} />
          )}
          <AlertsPanel alerts={data.alerts} />
        </div>
      )}
    </div>
  );
}
