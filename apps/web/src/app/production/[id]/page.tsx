"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader, Loading, ErrorState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, PlayCircle, CheckCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { ProductionOrderStatusBadge } from "@/components/sales-order/production-order-status-badge";
import { ProductionItemTable } from "@/components/production/production-item-table";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

interface Parameter {
  name: string;
  label: string;
  value: string;
  unit: string | null;
}

interface BomMaterial {
  materialCode: string;
  materialName: string;
  materialUnit: string | null;
  quantity: number;
}

interface ProductionOrderItem {
  id: string;
  productCode: string;
  productName: string;
  quantity: number;
  parameters: Parameter[];
  bomMaterials: BomMaterial[];
}

interface ProductionOrderTimeline {
  id: string;
  action: string;
  payload: Record<string, unknown> | null;
  createdBy: string | null;
  createdAt: string;
}

interface ProductionOrder {
  id: string;
  code: string;
  status: string;
  productionCenterName: string;
  startedAt: string | null;
  completedAt: string | null;
  items: ProductionOrderItem[];
  timeline: ProductionOrderTimeline[];
  salesOrder: {
    id: string;
    code: string;
    customerName: string;
    customerPhone: string;
    status: string;
  };
}

const TIMELINE_LABEL: Record<string, string> = {
  PRODUCTION_ORDER_CREATED: "ERP sinh phiếu sản xuất",
  STARTED: "Bắt đầu sản xuất",
  COMPLETED: "Hoàn thành sản xuất",
  CANCELLED: "Huỷ phiếu (theo Đơn hàng)",
};

export default function ProductionOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const [order, setOrder] = useState<ProductionOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [completing, setCompleting] = useState(false);

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<ProductionOrder>(`/production-orders/${id}`);
      setOrder(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể tải phiếu sản xuất.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  async function handleStart() {
    if (!confirm("Xác nhận bắt đầu sản xuất phiếu này? Vật tư sẽ được xuất kho theo BOM.")) return;
    setStarting(true);
    try {
      await apiPost(`/production-orders/${id}/start`);
      toast.success("Đã bắt đầu sản xuất.");
      fetchOrder();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Lỗi kết nối server.");
    } finally {
      setStarting(false);
    }
  }

  async function handleComplete() {
    if (!confirm("Xác nhận phiếu sản xuất này đã hoàn thành?")) return;
    setCompleting(true);
    try {
      await apiPost(`/production-orders/${id}/complete`);
      toast.success("Đã hoàn thành sản xuất.");
      fetchOrder();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Lỗi kết nối server.");
    } finally {
      setCompleting(false);
    }
  }

  if (loading) return <Loading />;
  if (error || !order) return <ErrorState description={error ?? "Không tìm thấy phiếu sản xuất."} onRetry={fetchOrder} />;

  const canStart = order.status === "PENDING" && hasPermission("production.start");
  const canComplete = order.status === "IN_PRODUCTION" && hasPermission("production.complete");
  const canViewOrder = hasPermission("sales-order.view");

  return (
    <div className="space-y-6">
      <PageHeader
        title={order.code}
        description={`Phiếu sản xuất — ${order.productionCenterName}`}
        actions={
          <div className="flex gap-2 flex-wrap justify-end">
            <Button variant="outline" onClick={() => router.push("/production")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Quay lại
            </Button>
            {canStart && (
              <Button onClick={handleStart} disabled={starting}>
                <PlayCircle className="mr-2 h-4 w-4" />
                {starting ? "Đang xử lý..." : "Bắt đầu sản xuất"}
              </Button>
            )}
            {canComplete && (
              <Button onClick={handleComplete} disabled={completing} className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="mr-2 h-4 w-4" />
                {completing ? "Đang xử lý..." : "Hoàn thành"}
              </Button>
            )}
          </div>
        }
      />

      {/* Header Info */}
      <div className="rounded-lg border p-5 space-y-4">
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div className="flex gap-2">
            <span className="text-muted-foreground w-36 shrink-0">Trạng thái</span>
            <ProductionOrderStatusBadge status={order.status} />
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground w-36 shrink-0">Xưởng</span>
            <span className="font-medium">{order.productionCenterName}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground w-36 shrink-0">Đơn hàng</span>
            {canViewOrder ? (
              <Link href={`/orders/${order.salesOrder.id}`} className="font-mono text-xs text-primary underline underline-offset-2">
                {order.salesOrder.code}
              </Link>
            ) : (
              <span className="font-mono text-xs">{order.salesOrder.code}</span>
            )}
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground w-36 shrink-0">Khách hàng</span>
            <span>{order.salesOrder.customerName}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground w-36 shrink-0">Bắt đầu lúc</span>
            <span>{order.startedAt ? new Date(order.startedAt).toLocaleString("vi-VN") : "—"}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground w-36 shrink-0">Hoàn thành lúc</span>
            <span>{order.completedAt ? new Date(order.completedAt).toLocaleString("vi-VN") : "—"}</span>
          </div>
        </div>
      </div>

      <Separator />

      {/* Items */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold">Sản phẩm cần sản xuất</h3>
        <ProductionItemTable items={order.items} />
      </div>

      {/* Timeline */}
      {order.timeline && order.timeline.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Lịch sử hoạt động
            </h3>
            <ol className="relative border-l border-muted-foreground/20 ml-3 space-y-4">
              {order.timeline.map((entry) => {
                const payload = entry.payload as Record<string, unknown> | null;
                return (
                  <li key={entry.id} className="ml-4">
                    <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-background bg-muted-foreground/40" />
                    <div className="text-sm font-medium">
                      {TIMELINE_LABEL[entry.action] ?? entry.action}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString("vi-VN")}
                      {entry.createdBy && ` — ${entry.createdBy}`}
                    </div>
                    {payload && (
                      <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                        {!!payload.reason && (
                          <div>Lý do: <span className="text-foreground">{String(payload.reason)}</span></div>
                        )}
                        {!!payload.salesOrderCode && (
                          <div>Đơn hàng: <span className="text-foreground font-mono">{String(payload.salesOrderCode)}</span></div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        </>
      )}
    </div>
  );
}
