"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { PageHeader, Loading, ErrorState, DateRangeFilter } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/api";
import { SalesOverviewPanel, type SalesOverview } from "@/components/dashboard/sales-overview-panel";
import { ProductionOverviewPanel, type ProductionOverview } from "@/components/dashboard/production-overview-panel";
import { WarehouseOverviewPanel, type WarehouseOverview } from "@/components/dashboard/warehouse-overview-panel";
import { DebtOverviewPanel, type DebtOverview } from "@/components/dashboard/debt-overview-panel";
import { ReturnOverviewPanel, type ReturnOverview } from "@/components/dashboard/return-overview-panel";
import { AlertsPanel, type AlertsData } from "@/components/dashboard/alerts-panel";

// Field permission-gated (production/warehouse/debt/returns) trả về null nếu
// user thiếu quyền view tương ứng — xem apps/api/src/dashboard/dashboard.controller.ts.
// `sales` và `alerts.delayedOrders` hiện không bị ẩn theo quyền (ghi nhận, không tự sửa BE).
interface DashboardOverview {
  sales: SalesOverview;
  production: ProductionOverview | null;
  warehouse: WarehouseOverview | null;
  debt: DebtOverview | null;
  returns: ReturnOverview | null;
  alerts: AlertsData;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await apiGet<DashboardOverview>("/dashboard/overview");
      setData(json);
    } catch {
      setError("Không thể tải dữ liệu dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Tổng quan tình hình kinh doanh, sản xuất, kho và công nợ"
        actions={
          <div className="flex items-center gap-2">
            <DateRangeFilter
              dateFrom={dateFrom}
              onDateFromChange={setDateFrom}
              dateTo={dateTo}
              onDateToChange={setDateTo}
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
          {data.production && <ProductionOverviewPanel production={data.production} />}
          {data.warehouse && <WarehouseOverviewPanel warehouse={data.warehouse} />}
          {data.debt && <DebtOverviewPanel debt={data.debt} dateFrom={dateFrom} dateTo={dateTo} />}
          {data.returns && <ReturnOverviewPanel returns={data.returns} />}
          <AlertsPanel alerts={data.alerts} />
        </div>
      )}
    </div>
  );
}
