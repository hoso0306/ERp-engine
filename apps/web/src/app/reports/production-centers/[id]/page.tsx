"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader, Loading, ErrorState, EmptyState } from "@/components/shared";
import { StatTile } from "@/components/dashboard/stat-tile";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ReportRangeFilter,
  ReportTrendChart,
  formatMoney,
  autoGroupBy,
  defaultReportRange,
} from "@/components/report";
import { ProductionTable } from "@/components/production/production-table";
import { TAB_STATUS_PARAM, type ProductionOrderTab } from "@/components/production/production-filter";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import { useSetBreadcrumbExtra } from "@/context/breadcrumb-context";

interface ProductionCenter {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

interface CenterRevenue {
  totalRevenue: number;
  orderCount: number;
  series: { period: string; revenue: number }[];
}

interface ProductionOrderRow {
  id: string;
  code: string;
  productionCenterName: string;
  status: string;
  salesOrder: { id: string; code: string; customerName: string; ownerName: string | null };
  _count: { items: number };
  isPrinted: boolean;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

type GroupBy = "day" | "week" | "month" | "year";

const STATUS_TABS: { value: ProductionOrderTab; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "pending", label: "Chờ SX" },
  { value: "in_production", label: "Đang SX" },
  { value: "completed", label: "Hoàn thành" },
  { value: "cancelled", label: "Đã huỷ" },
];

// Doanh thu theo thời gian của 1 xưởng (sprint-04/028) — GROSS (SUM thành
// tiền dòng đơn hàng thuộc xưởng, chưa trừ hàng hoàn), cùng nguồn với khối
// "Doanh số theo xưởng" ở Dashboard. Gate report.revenue-by-production-center
// (cùng quyền thẻ "Doanh thu theo xưởng", 029).
function CenterRevenueSection({ centerId }: { centerId: string }) {
  const initial = defaultReportRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [groupBy, setGroupBy] = useState<GroupBy>(() => autoGroupBy(initial.from, initial.to));
  const [data, setData] = useState<CenterRevenue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from, to, groupBy });
      setData(await apiGet<CenterRevenue>(`/reports/revenue-by-production-center/${centerId}?${params}`));
    } catch {
      setError("Không thể tải doanh thu của xưởng.");
    } finally {
      setLoading(false);
    }
  }, [centerId, from, to, groupBy]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <DashboardCard
      title="Doanh thu theo thời gian"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border p-0.5">
            {(["day", "week", "month", "year"] as GroupBy[]).map((g) => (
              <Button key={g} variant={groupBy === g ? "default" : "ghost"} size="sm" onClick={() => setGroupBy(g)}>
                {g === "day" ? "Ngày" : g === "week" ? "Tuần" : g === "month" ? "Tháng" : "Năm"}
              </Button>
            ))}
          </div>
          <ReportRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
        </div>
      }
    >
      {loading && !data ? (
        <Loading />
      ) : error ? (
        <ErrorState description={error} onRetry={fetchData} />
      ) : !data ? null : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <StatTile label="Doanh thu (chưa trừ hoàn)" value={formatMoney(data.totalRevenue)} />
            <StatTile label="Số đơn" value={String(data.orderCount)} />
          </div>
          <ReportTrendChart
            data={data.series}
            variant={groupBy === "day" ? "bar" : "line"}
            series={[{ key: "revenue", label: "Doanh thu", color: "var(--chart-1)", formatValue: formatMoney }]}
          />
        </div>
      )}
    </DashboardCard>
  );
}

// Danh sách phiếu sản xuất của xưởng — tái dùng GET /production-orders có
// sẵn filter productionCenterId, không thêm endpoint mới. Gate production.view.
function CenterProductionOrdersSection({ centerId }: { centerId: string }) {
  const [tab, setTab] = useState<ProductionOrderTab>("all");
  const [orders, setOrders] = useState<ProductionOrderRow[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        productionCenterId: centerId,
        page: String(page),
        limit: String(limit),
      });
      const statusParam = TAB_STATUS_PARAM[tab];
      if (statusParam) params.set("status", statusParam);
      const json = await apiGet<{ data: ProductionOrderRow[]; meta: typeof meta }>(`/production-orders?${params}`);
      setOrders(json.data);
      setMeta(json.meta);
    } catch {
      setError("Không thể tải danh sách phiếu sản xuất.");
    } finally {
      setLoading(false);
    }
  }, [centerId, tab, page, limit]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    setPage(1);
  }, [tab, limit]);

  return (
    <DashboardCard
      title="Phiếu sản xuất"
      actions={
        <div className="flex flex-wrap rounded-md border p-0.5">
          {STATUS_TABS.map((t) => (
            <Button key={t.value} variant={tab === t.value ? "default" : "ghost"} size="sm" onClick={() => setTab(t.value)}>
              {t.label}
            </Button>
          ))}
        </div>
      }
    >
      {loading && orders.length === 0 ? (
        <Loading />
      ) : error ? (
        <ErrorState description={error} onRetry={fetchOrders} />
      ) : orders.length === 0 ? (
        <EmptyState title="Không có phiếu sản xuất" description="Xưởng chưa có phiếu sản xuất nào ở trạng thái này." />
      ) : (
        <ProductionTable orders={orders} meta={meta} onPageChange={setPage} onLimitChange={setLimit} />
      )}
    </DashboardCard>
  );
}

// Báo cáo chi tiết xưởng (sprint-04/028, nhóm Sản xuất) — drill-down từ
// /reports/production-centers và từ khối "Doanh số theo xưởng" ở Dashboard.
// Chỉ đọc. Danh sách phiếu SX ẩn theo production.view.
export default function ProductionCenterReportPage() {
  const params = useParams();
  const id = String(params.id);
  const { hasPermission } = useAuth();
  const [center, setCenter] = useState<ProductionCenter | null>(null);
  const [error, setError] = useState<string | null>(null);

  useSetBreadcrumbExtra(center ? { label: center.name, href: "/reports/production-centers" } : null);

  useEffect(() => {
    apiGet<ProductionCenter>(`/production-centers/${id}`)
      .then(setCenter)
      .catch(() => setError("Không tìm thấy xưởng sản xuất."));
  }, [id]);

  if (error) return <ErrorState description={error} />;
  if (!center) return <Loading />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={center.name}
        description={center.description ?? `Mã xưởng: ${center.code}`}
        actions={
          <Badge variant={center.isActive ? "default" : "secondary"}>
            {center.isActive ? "Đang dùng" : "Ẩn"}
          </Badge>
        }
      />
      <CenterRevenueSection centerId={id} />
      {hasPermission("production.view") && <CenterProductionOrdersSection centerId={id} />}
    </div>
  );
}
