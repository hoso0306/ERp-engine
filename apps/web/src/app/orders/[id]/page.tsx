"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader, Loading, ErrorState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Truck, CheckCircle, XCircle, Settings2, Clock, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { SalesOrderStatusBadge, SALES_ORDER_STATUS_LABEL } from "@/components/sales-order/sales-order-status-badge";
import { PaymentStatusBadge, PAYMENT_STATUS_LABEL } from "@/components/sales-order/payment-status-badge";
import { ProductionOrderStatusBadge } from "@/components/sales-order/production-order-status-badge";
import { SalesOrderItemTable } from "@/components/sales-order/sales-order-item-table";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

interface Parameter {
  name: string;
  label: string;
  value: string;
  unit: string | null;
}

interface OrderBOMItem {
  id: string;
  materialCode: string;
  materialName: string;
  materialUnit: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

interface SalesOrderItem {
  id: string;
  productCode: string;
  productName: string;
  quantity: number;
  systemPrice: number;
  groupDiscount: number;
  finalPrice: number;
  subtotal: number;
  parameters: Parameter[];
  bom: { items: OrderBOMItem[] } | null;
}

interface ProductionOrderItem {
  id: string;
  productCode: string;
  productName: string;
  quantity: number;
}

interface ProductionOrder {
  id: string;
  code: string;
  productionCenterName: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  items: ProductionOrderItem[];
}

interface Receivable {
  id: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate: string | null;
}

interface SalesOrderTimeline {
  id: string;
  action: string;
  payload: Record<string, unknown> | null;
  createdBy: string | null;
  createdAt: string;
}

interface SalesOrder {
  id: string;
  code: string;
  quotationCode: string;
  quotation: { id: string } | null;
  customerName: string;
  customerPhone: string;
  ownerName: string | null;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  totalProductionOrders: number;
  completedProductionOrders: number;
  expectedDeliveryDate: string | null;
  actualDeliveryDate: string | null;
  note: string | null;
  items: SalesOrderItem[];
  productionOrders: ProductionOrder[];
  timeline: SalesOrderTimeline[];
  receivable: Receivable | null;
}

const TIMELINE_LABEL: Record<string, string> = {
  SALES_ORDER_CREATED: "Tạo đơn hàng",
  PRODUCTION_ORDERS_GENERATED: "Sinh phiếu sản xuất",
  PRODUCTION_COMPLETED: "Hoàn thành sản xuất",
  SHIPPED: "Gửi xe",
  DELIVERED: "Khách đã nhận",
  PAYMENT_STATUS_CHANGED: "Cập nhật thanh toán",
  MANUAL_OVERRIDE: "Điều chỉnh thủ công",
  CANCELLED: "Huỷ đơn hàng",
};

// Action nào mang fromStatus/toStatus theo PaymentStatus thay vì SalesOrderStatus.
const PAYMENT_STATUS_ACTIONS = new Set(["PAYMENT_STATUS_CHANGED"]);

function formatMoney(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n) + " ₫";
}

export default function SalesOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [shipping, setShipping] = useState(false);
  const [delivering, setDelivering] = useState(false);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelSaving, setCancelSaving] = useState(false);

  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideStatus, setOverrideStatus] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideBy, setOverrideBy] = useState("");
  const [overrideSaving, setOverrideSaving] = useState(false);

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<SalesOrder>(`/sales-orders/${id}`);
      setOrder(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể tải đơn hàng.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  async function handleShip() {
    if (!confirm("Xác nhận gửi xe cho đơn hàng này?")) return;
    setShipping(true);
    try {
      await apiPost(`/sales-orders/${id}/ship`);
      toast.success("Đã gửi xe.");
      fetchOrder();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Lỗi kết nối server.");
    } finally {
      setShipping(false);
    }
  }

  async function handleDeliver() {
    if (!confirm("Xác nhận khách hàng đã nhận hàng?")) return;
    setDelivering(true);
    try {
      await apiPost(`/sales-orders/${id}/deliver`);
      toast.success("Đã xác nhận khách nhận hàng.");
      fetchOrder();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Lỗi kết nối server.");
    } finally {
      setDelivering(false);
    }
  }

  async function handleCancel(e: React.FormEvent) {
    e.preventDefault();
    if (!cancelReason.trim()) { toast.error("Vui lòng nhập lý do huỷ."); return; }
    setCancelSaving(true);
    try {
      await apiPost(`/sales-orders/${id}/cancel`, { reason: cancelReason.trim() });
      toast.success("Đã huỷ đơn hàng.");
      setCancelOpen(false);
      setCancelReason("");
      fetchOrder();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Lỗi kết nối server.");
    } finally {
      setCancelSaving(false);
    }
  }

  async function handleOverride(e: React.FormEvent) {
    e.preventDefault();
    if (!overrideStatus) { toast.error("Vui lòng chọn trạng thái mới."); return; }
    if (!overrideReason.trim()) { toast.error("Vui lòng nhập lý do điều chỉnh."); return; }
    setOverrideSaving(true);
    try {
      await apiPost(`/sales-orders/${id}/override`, {
        newStatus: overrideStatus,
        reason: overrideReason.trim(),
        overrideBy: overrideBy.trim() || undefined,
      });
      toast.success("Đã điều chỉnh trạng thái.");
      setOverrideOpen(false);
      setOverrideReason("");
      setOverrideBy("");
      fetchOrder();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Lỗi kết nối server.");
    } finally {
      setOverrideSaving(false);
    }
  }

  if (loading) return <Loading />;
  if (error || !order) return <ErrorState description={error ?? "Không tìm thấy đơn hàng."} onRetry={fetchOrder} />;

  const canShip = order.status === "PRODUCTION_COMPLETED" && hasPermission("sales-order.ship");
  const canDeliver = order.status === "SHIPPED" && hasPermission("sales-order.deliver");
  const canCancel = order.status !== "CANCELLED" && order.status !== "DELIVERED" && hasPermission("sales-order.cancel");
  const hasDeposit = Number(order.receivable?.paidAmount ?? 0) > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={order.code}
        description={`Đơn hàng của ${order.customerName}`}
        actions={
          <div className="flex gap-2 flex-wrap justify-end">
            <Button variant="outline" onClick={() => router.push("/orders")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Quay lại
            </Button>
            {canShip && (
              <Button onClick={handleShip} disabled={shipping}>
                <Truck className="mr-2 h-4 w-4" />
                {shipping ? "Đang xử lý..." : "Gửi xe"}
              </Button>
            )}
            {canDeliver && (
              <Button onClick={handleDeliver} disabled={delivering} className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="mr-2 h-4 w-4" />
                {delivering ? "Đang xử lý..." : "Khách đã nhận"}
              </Button>
            )}
            {canCancel && (
              <Button
                variant="destructive"
                onClick={() => { setCancelReason(""); setCancelOpen(true); }}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Huỷ đơn
              </Button>
            )}
            {hasPermission("sales-order.override") && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => {
                  setOverrideStatus("");
                  setOverrideReason("");
                  setOverrideBy("");
                  setOverrideOpen(true);
                }}
              >
                <Settings2 className="mr-2 h-4 w-4" />
                Override
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
            <SalesOrderStatusBadge status={order.status} />
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground w-36 shrink-0">Thanh toán</span>
            <PaymentStatusBadge status={order.paymentStatus} />
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground w-36 shrink-0">Khách hàng</span>
            <span className="font-medium">{order.customerName}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground w-36 shrink-0">Số điện thoại</span>
            <span>{order.customerPhone}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground w-36 shrink-0">Báo giá gốc</span>
            {order.quotation ? (
              <Link href={`/quotations/${order.quotation.id}`} className="font-mono text-xs text-primary underline underline-offset-2">
                {order.quotationCode}
              </Link>
            ) : (
              <span className="font-mono text-xs">{order.quotationCode}</span>
            )}
          </div>
          {order.ownerName && (
            <div className="flex gap-2">
              <span className="text-muted-foreground w-36 shrink-0">Người phụ trách</span>
              <span>{order.ownerName}</span>
            </div>
          )}
          <div className="flex gap-2">
            <span className="text-muted-foreground w-36 shrink-0">Ngày giao dự kiến</span>
            <span>{order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate).toLocaleDateString("vi-VN") : "—"}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground w-36 shrink-0">Ngày giao thực tế</span>
            <span>{order.actualDeliveryDate ? new Date(order.actualDeliveryDate).toLocaleDateString("vi-VN") : "—"}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground w-36 shrink-0">Tiến độ SX</span>
            <span>{order.completedProductionOrders}/{order.totalProductionOrders} phiếu</span>
          </div>
          {order.note && (
            <div className="flex gap-2 col-span-2">
              <span className="text-muted-foreground w-36 shrink-0">Ghi chú</span>
              <span>{order.note}</span>
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* Items */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold">Danh sách sản phẩm</h3>
        <SalesOrderItemTable items={order.items} />
      </div>

      <Separator />

      {/* Production Orders — chỉ xem, thao tác thuộc /production (Bước 3) */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold">Phiếu sản xuất</h3>
        {order.productionOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có phiếu sản xuất nào.</p>
        ) : (
          <div className="rounded-md border divide-y">
            {order.productionOrders.map((po) => (
              <div key={po.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    {hasPermission("production.view") ? (
                      <Link href={`/production/${po.id}`} className="font-mono text-sm font-medium text-primary underline underline-offset-2">
                        {po.code}
                      </Link>
                    ) : (
                      <span className="font-mono text-sm font-medium">{po.code}</span>
                    )}
                    <span className="text-sm text-muted-foreground"> — {po.productionCenterName}</span>
                  </div>
                  <ProductionOrderStatusBadge status={po.status} />
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {po.items.map((it) => (
                    <div key={it.id}>{it.productName} × {Number(it.quantity)}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Debt summary */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Công nợ</h3>
          {order.receivable && hasPermission("debt.view") && (
            <Link
              href={`/debts/${order.receivable.id}`}
              className="text-sm text-primary underline underline-offset-2"
            >
              Xem chi tiết công nợ
            </Link>
          )}
        </div>
        {order.receivable ? (
          <div className="rounded-lg border p-5 grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Tổng tiền</p>
              <p className="font-mono font-semibold">{formatMoney(Number(order.receivable.totalAmount))}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Đã thu</p>
              <p className="font-mono font-semibold text-green-600">{formatMoney(Number(order.receivable.paidAmount))}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Còn lại</p>
              <p className="font-mono font-semibold text-destructive">{formatMoney(Number(order.receivable.remainingAmount))}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Chưa có công nợ.</p>
        )}
      </div>

      {/* Cancel Dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Huỷ đơn hàng {order.code}</DialogTitle>
          </DialogHeader>
          <form id="cancel-form" onSubmit={handleCancel} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Hành động này không thể hoàn tác. Vui lòng nhập lý do huỷ.
            </p>
            {hasDeposit && (
              <div className="rounded-md border border-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3 flex gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  Đơn hàng đã thu cọc. ERP sẽ đóng công nợ. Việc hoàn tiền thực hiện ngoài hệ thống.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="cancel-reason">Lý do huỷ *</Label>
              <Textarea
                id="cancel-reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                placeholder="Ví dụ: Khách đổi ý, sai thông tin đơn hàng..."
                required
              />
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Đóng</Button>
            <Button
              type="submit"
              form="cancel-form"
              variant="destructive"
              disabled={cancelSaving || !cancelReason.trim()}
            >
              {cancelSaving ? "Đang huỷ..." : "Xác nhận huỷ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Override Dialog */}
      <Dialog open={overrideOpen} onOpenChange={setOverrideOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Điều chỉnh thủ công — {order.code}</DialogTitle>
          </DialogHeader>
          <form id="override-form" onSubmit={handleOverride} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Trạng thái hiện tại:{" "}
              <strong>{SALES_ORDER_STATUS_LABEL[order.status] ?? order.status}</strong>
            </p>
            <div className="space-y-2">
              <Label>Trạng thái mới *</Label>
              <Select value={overrideStatus} onValueChange={(v) => setOverrideStatus(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn trạng thái..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SALES_ORDER_STATUS_LABEL)
                    .filter(([k]) => k !== order.status)
                    .map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="override-reason">Lý do *</Label>
              <Textarea
                id="override-reason"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                rows={3}
                placeholder="Mô tả lý do điều chỉnh thủ công..."
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="override-by">Người thực hiện</Label>
              <Input
                id="override-by"
                value={overrideBy}
                onChange={(e) => setOverrideBy(e.target.value)}
                placeholder="Tên người duyệt override..."
              />
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideOpen(false)}>Đóng</Button>
            <Button
              type="submit"
              form="override-form"
              variant="destructive"
              disabled={overrideSaving || !overrideStatus || !overrideReason.trim()}
            >
              {overrideSaving ? "Đang lưu..." : "Xác nhận Override"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                const statusLabelMap = PAYMENT_STATUS_ACTIONS.has(entry.action)
                  ? PAYMENT_STATUS_LABEL
                  : SALES_ORDER_STATUS_LABEL;
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
                        {!!payload.quotationCode && (
                          <div>Báo giá gốc: <span className="text-foreground font-mono">{String(payload.quotationCode)}</span></div>
                        )}
                        {Array.isArray(payload.productionOrderCodes) && payload.productionOrderCodes.length > 0 && (
                          <div>Phiếu sản xuất: <span className="text-foreground font-mono">{(payload.productionOrderCodes as string[]).join(", ")}</span></div>
                        )}
                        {!!payload.fromStatus && !!payload.toStatus && (
                          <div>
                            Trạng thái: <span className="text-foreground">
                              {statusLabelMap[String(payload.fromStatus)] ?? String(payload.fromStatus)}
                            </span>
                            {" → "}
                            <span className="text-foreground">
                              {statusLabelMap[String(payload.toStatus)] ?? String(payload.toStatus)}
                            </span>
                          </div>
                        )}
                        {typeof payload.amount === "number" && (
                          <div>Số tiền: <span className="text-foreground font-mono">{formatMoney(payload.amount)}</span></div>
                        )}
                        {typeof payload.paidAmount === "number" && (
                          <div>Đã thu (cọc): <span className="text-foreground font-mono">{formatMoney(payload.paidAmount)}</span></div>
                        )}
                        {!!payload.refundNote && (
                          <div className="italic">{String(payload.refundNote)}</div>
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
