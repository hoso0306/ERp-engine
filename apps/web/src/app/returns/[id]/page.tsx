"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader, Loading, ErrorState, ConfirmDialog } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { ReturnStatusBadge } from "@/components/return/return-status-badge";
import { ReturnItemTable } from "@/components/return/return-item-table";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

interface Parameter {
  name: string;
  label: string;
  value: string;
  unit: string | null;
}

interface RecoveryInventory {
  id: string;
  code: string;
  quantity: number;
  status: string;
  location: string | null;
}

interface ReturnItem {
  id: string;
  productCode: string;
  productName: string;
  productParameters: Parameter[] | null;
  orderedQuantity: number;
  returnedQuantity: number;
  unitPriceSnapshot: number;
  reason: string;
  note: string | null;
  recoveryInventory: RecoveryInventory | null;
}

interface ReturnDetail {
  id: string;
  code: string;
  salesOrderId: string;
  salesOrderCode: string;
  customerName: string;
  returnDate: string;
  receivedBy: string | null;
  completedByName: string | null;
  status: string;
  note: string | null;
  totalValue: number;
  customerBorneAmount: number;
  companyBorneReason: string | null;
  items: ReturnItem[];
  salesOrder: { receivable: { id: string; remainingAmount: number } | null };
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n) + " ₫";
}

export default function ReturnDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const [ret, setRet] = useState<ReturnDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completeConfirmOpen, setCompleteConfirmOpen] = useState(false);

  // Nút dự phòng "Điều chỉnh giảm công nợ" (rà soát nghiệp vụ Return,
  // 27/08/2026) — dùng khi bước tự động lúc tạo phiếu hoàn bị lỗi/bỏ qua,
  // hoặc cần điều chỉnh thêm sau này.
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  const fetchReturn = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<ReturnDetail>(`/returns/${id}`);
      setRet(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể tải phiếu hoàn.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchReturn(); }, [fetchReturn]);

  async function handleComplete() {
    setCompleting(true);
    try {
      await apiPost(`/returns/${id}/complete`);
      toast.success("Đã hoàn tất xử lý.");
      fetchReturn();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Lỗi kết nối server.");
    } finally {
      setCompleting(false);
    }
  }

  async function handleAdjust() {
    if (!ret?.salesOrder.receivable) return;
    const amount = Number(adjustAmount);
    if (!amount || amount <= 0) {
      toast.error("Số tiền điều chỉnh phải lớn hơn 0.");
      return;
    }
    if (!adjustReason.trim()) {
      toast.error("Vui lòng nhập lý do điều chỉnh.");
      return;
    }
    setAdjusting(true);
    try {
      await apiPost(`/receivables/${ret.salesOrder.receivable.id}/manual-adjustment`, {
        amount,
        reason: adjustReason.trim(),
        returnCode: ret.code,
        returnId: ret.id,
      });
      toast.success("Đã giảm công nợ.");
      setAdjustOpen(false);
      fetchReturn();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Lỗi kết nối server.");
    } finally {
      setAdjusting(false);
    }
  }

  if (loading) return <Loading />;
  if (error || !ret) return <ErrorState description={error ?? "Không tìm thấy phiếu hoàn."} onRetry={fetchReturn} />;

  const canComplete = ret.status === "PROCESSING" && hasPermission("return.update");
  const canViewOrder = hasPermission("sales-order.view");
  const companyBorneValue = Number(ret.totalValue) - Number(ret.customerBorneAmount);
  const canAdjustDebt = !!ret.salesOrder.receivable && hasPermission("debt.manual-adjustment");

  return (
    <div className="space-y-6">
      <PageHeader
        title={ret.code}
        description={`Phiếu hoàn của ${ret.customerName}`}
        actions={
          <div className="flex gap-2 flex-wrap justify-end">
            <Button variant="outline" onClick={() => router.push("/returns")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Quay lại
            </Button>
            {canAdjustDebt && (
              <Button
                variant="outline"
                onClick={() => {
                  setAdjustAmount(companyBorneValue > 0 ? String(companyBorneValue) : "");
                  setAdjustReason(ret.companyBorneReason ?? "");
                  setAdjustOpen(true);
                }}
              >
                Điều chỉnh giảm công nợ
              </Button>
            )}
            {canComplete && (
              <Button onClick={() => setCompleteConfirmOpen(true)} disabled={completing} className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="mr-2 h-4 w-4" />
                {completing ? "Đang xử lý..." : "Hoàn tất xử lý"}
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
            <ReturnStatusBadge status={ret.status} />
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground w-36 shrink-0">Đơn hàng gốc</span>
            {canViewOrder ? (
              <Link href={`/orders/${ret.salesOrderId}`} className="font-mono text-xs text-primary underline underline-offset-2">
                {ret.salesOrderCode}
              </Link>
            ) : (
              <span className="font-mono text-xs">{ret.salesOrderCode}</span>
            )}
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground w-36 shrink-0">Khách hàng</span>
            <span className="font-medium">{ret.customerName}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground w-36 shrink-0">Ngày trả</span>
            <span>{new Date(ret.returnDate).toLocaleDateString("vi-VN")}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground w-36 shrink-0">Giá trị phiếu hoàn</span>
            <span className="font-mono font-medium">
              {formatMoney(Number(ret.totalValue))}
              <span className="ml-1 font-sans text-xs text-muted-foreground">(đã gồm VAT)</span>
            </span>
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground w-36 shrink-0">Khách chịu</span>
            <span className="font-mono">{formatMoney(Number(ret.customerBorneAmount))}</span>
          </div>
          {companyBorneValue > 0 && (
            <div className="flex gap-2 col-span-2">
              <span className="text-muted-foreground w-36 shrink-0">Công ty chịu</span>
              <span className="font-mono">
                {formatMoney(companyBorneValue)}
                {ret.companyBorneReason && (
                  <span className="ml-2 font-sans text-xs text-muted-foreground">({ret.companyBorneReason})</span>
                )}
              </span>
            </div>
          )}
          {ret.receivedBy && (
            <div className="flex gap-2">
              <span className="text-muted-foreground w-36 shrink-0">Người nhận</span>
              <span>{ret.receivedBy}</span>
            </div>
          )}
          {ret.completedByName && (
            <div className="flex gap-2">
              <span className="text-muted-foreground w-36 shrink-0">Người hoàn thành</span>
              <span>{ret.completedByName}</span>
            </div>
          )}
          {ret.note && (
            <div className="flex gap-2 col-span-2">
              <span className="text-muted-foreground w-36 shrink-0">Ghi chú</span>
              <span>{ret.note}</span>
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* Items */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold">Danh sách sản phẩm trả</h3>
        <ReturnItemTable items={ret.items} totalValue={Number(ret.totalValue)} />
      </div>

      <ConfirmDialog
        open={completeConfirmOpen}
        onOpenChange={setCompleteConfirmOpen}
        title="Hoàn tất xử lý"
        description="Chốt xong vụ việc này với khách? Không ảnh hưởng tài chính, không thể quay lại."
        onConfirm={handleComplete}
      />

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Điều chỉnh giảm công nợ</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Giảm thẳng công nợ đơn {ret.salesOrderCode}, không tạo phiếu thu — không ảnh hưởng báo cáo dòng tiền mặt.
            </p>
            <div className="space-y-2">
              <Label htmlFor="adjust-amount">Số tiền *</Label>
              <Input
                id="adjust-amount"
                type="number"
                min="1"
                max={ret.salesOrder.receivable?.remainingAmount}
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
              />
              {ret.salesOrder.receivable && (
                <p className="text-xs text-muted-foreground">
                  Còn phải thu: {formatMoney(Number(ret.salesOrder.receivable.remainingAmount))}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="adjust-reason">Lý do *</Label>
              <Textarea
                id="adjust-reason"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)}>Huỷ</Button>
            <Button onClick={handleAdjust} disabled={adjusting}>
              {adjusting ? "Đang lưu..." : "Xác nhận giảm công nợ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
