"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader, Loading, ErrorState, ConfirmDialog } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, CreditCard, Banknote, FileText, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { RiskBadge } from "@/components/debt/risk-badge";
import { PaymentTable } from "@/components/debt/payment-table";
import { PaymentDialog } from "@/components/debt/payment-dialog";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

// 023-cong-no-payment-allocation-fifo: lịch sử thu tiền đọc qua allocations
// (PaymentAllocation), không còn payments trực tiếp — xem payment-table.tsx.
interface AllocationRow {
  id: string;
  allocatedTotal: number;
  payment: {
    id: string;
    code: string;
    paymentDate: string;
    paymentMethod: string;
    referenceNumber: string | null;
    note: string | null;
    createdBy: string | null;
    type: string;
    reversedBy: { id: string } | null;
  };
}

interface Receivable {
  id: string;
  totalAmount: number;
  totalAmountBeforeVat: number;
  paidAmount: number;
  remainingAmount: number;
  remainingAmountBeforeVat: number;
  dueDate: string | null;
  daysOverdue: number | null;
  riskLevel: string | null;
  // 024-cong-no-vat-settlement.md — true khi kế toán đã dùng action "Thu tiền
  // mặt (không xuất hóa đơn)", điều kiện để hiện nút "Tạo VAT Settlement".
  closedWithoutVat: boolean;
  allocations: AllocationRow[];
  salesOrder: {
    id: string;
    code: string;
    customerName: string;
    customerPhone: string;
    status: string;
    paymentStatus: string;
  };
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("vi-VN").format(amount) + " ₫";
}

export default function ReceivableDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const [receivable, setReceivable] = useState<Receivable | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [closeWithoutVatOpen, setCloseWithoutVatOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);

  const fetchReceivable = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<Receivable>(`/receivables/${id}`);
      setReceivable(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể tải công nợ.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchReceivable(); }, [fetchReceivable]);

  if (loading) return <Loading />;
  if (error || !receivable) return <ErrorState description={error ?? "Không tìm thấy công nợ."} onRetry={fetchReceivable} />;

  const canPay = receivable.salesOrder.status !== "CANCELLED" && hasPermission("debt.create-payment");
  // 024-cong-no-vat-settlement.md Việc 6: 🟢 chỉ hiện khi còn nợ (remainingAmount > 0)
  // và chưa từng đóng theo chế độ này. Rà soát mô hình công nợ lần 2 (chốt
  // 28/07/2026): KHÔNG ẩn theo remainingAmountBeforeVat > 0 nữa — luôn hiện
  // nút, để backend tự báo lỗi rõ ràng khi bấm lúc chưa thu đủ phần gốc
  // (validate ở closeReceivableWithoutVat() không đổi, chỉ FE không tiền-đoán
  // điều kiện nữa để tránh cảm giác "nút biến mất bí ẩn").
  const canCloseWithoutVat =
    canPay &&
    Number(receivable.remainingAmount) > 0 &&
    !receivable.closedWithoutVat;
  const canCreateVatSettlement = canPay && receivable.closedWithoutVat;
  // Hoàn tác action đóng-không-VAT (bổ sung 26/07/2026) — chỉ hiện khi đã
  // đóng; nếu đã thuộc 1 VAT Settlement (chưa huỷ), backend sẽ chặn và báo lỗi.
  const canReopenWithoutVat = canPay && receivable.closedWithoutVat;

  async function handleCloseWithoutVat() {
    try {
      await apiPost(`/receivables/${id}/close-without-vat`);
      toast.success("Đã đóng công nợ theo chế độ tiền mặt không xuất hóa đơn.");
      fetchReceivable();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Lỗi kết nối server.");
    }
  }

  async function handleReopenWithoutVat() {
    try {
      await apiPost(`/receivables/${id}/reopen-without-vat`);
      toast.success("Đã hoàn tác — công nợ trở lại bình thường.");
      fetchReceivable();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Lỗi kết nối server.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Công nợ — ${receivable.salesOrder.code}`}
        breadcrumbLabel={receivable.salesOrder.code}
        description={`Khách hàng ${receivable.salesOrder.customerName}`}
        actions={
          <div className="flex gap-2 flex-wrap justify-end">
            <Button variant="outline" onClick={() => router.push("/debts")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Quay lại
            </Button>
            {canCloseWithoutVat && (
              <Button
                variant="outline"
                className="border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100 hover:text-teal-800 dark:border-teal-800 dark:bg-teal-950/30 dark:text-teal-400 dark:hover:bg-teal-950/50"
                onClick={() => setCloseWithoutVatOpen(true)}
              >
                <Banknote className="mr-2 h-4 w-4" />
                Đóng công nợ (không xuất hóa đơn)
              </Button>
            )}
            {canCreateVatSettlement && (
              <Button
                variant="outline"
                className="border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100 hover:text-violet-800 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-400 dark:hover:bg-violet-950/50"
                onClick={() => router.push(`/vat-settlements/new?receivableId=${receivable.id}`)}
              >
                <FileText className="mr-2 h-4 w-4" />
                Tạo Quyết toán VAT
              </Button>
            )}
            {canReopenWithoutVat && (
              <Button
                variant="outline"
                className="border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400 dark:hover:bg-amber-950/50"
                onClick={() => setReopenOpen(true)}
              >
                <Undo2 className="mr-2 h-4 w-4" />
                Hoàn tác (đóng công nợ không xuất hóa đơn)
              </Button>
            )}
            {canPay && (
              <Button onClick={() => setPaymentDialogOpen(true)}>
                <CreditCard className="mr-2 h-4 w-4" />
                Ghi nhận thanh toán
              </Button>
            )}
          </div>
        }
      />

      <div className="rounded-lg border p-5 space-y-4">
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div className="flex gap-2">
            <span className="text-muted-foreground w-36 shrink-0">Đơn hàng</span>
            {hasPermission("sales-order.view") ? (
              <Link href={`/orders/${receivable.salesOrder.id}`} className="font-mono text-xs text-primary underline underline-offset-2">
                {receivable.salesOrder.code}
              </Link>
            ) : (
              <span className="font-mono text-xs">{receivable.salesOrder.code}</span>
            )}
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground w-36 shrink-0">Khách hàng</span>
            <span className="font-medium">{receivable.salesOrder.customerName}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground w-36 shrink-0">Tổng tiền</span>
            <span className="flex flex-col">
              <span className="font-mono font-semibold">{formatMoney(Number(receivable.totalAmount))}</span>
              <span className="text-xs text-muted-foreground">trước VAT: {formatMoney(Number(receivable.totalAmountBeforeVat))}</span>
            </span>
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground w-36 shrink-0">Đã thu</span>
            <span className="font-mono font-semibold text-green-600">{formatMoney(Number(receivable.paidAmount))}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground w-36 shrink-0">Còn lại</span>
            <span className="flex flex-col">
              <span className="font-mono font-semibold text-destructive">{formatMoney(Number(receivable.remainingAmount))}</span>
              <span className="text-xs text-muted-foreground">trước VAT: {formatMoney(Number(receivable.remainingAmountBeforeVat))}</span>
            </span>
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-muted-foreground w-36 shrink-0">Hạn thanh toán</span>
            {receivable.dueDate ? (
              <span className="flex items-center gap-2">
                {new Date(receivable.dueDate).toLocaleDateString("vi-VN")}
                <RiskBadge riskLevel={receivable.riskLevel} />
                {receivable.daysOverdue !== null && receivable.daysOverdue > 0 && (
                  <span className="text-xs text-muted-foreground">({receivable.daysOverdue} ngày quá hạn)</span>
                )}
              </span>
            ) : (
              <span className="text-muted-foreground">— (chưa giao hàng)</span>
            )}
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-base font-semibold">Lịch sử thanh toán</h3>
        <PaymentTable allocations={receivable.allocations} onReversed={fetchReceivable} />
      </div>

      <PaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        salesOrderId={receivable.salesOrder.id}
        remainingAmount={Number(receivable.remainingAmount)}
        remainingAmountBeforeVat={Number(receivable.remainingAmountBeforeVat)}
        onSaved={fetchReceivable}
      />

      <ConfirmDialog
        open={closeWithoutVatOpen}
        onOpenChange={setCloseWithoutVatOpen}
        title="Đóng công nợ (không xuất hóa đơn)"
        description="ERP sẽ coi công nợ này đã kết thúc (còn lại = 0), không tiếp tục theo dõi phần VAT như công nợ bình thường. Nếu khách quay lại yêu cầu xuất hóa đơn sau này, dùng chức năng Tạo Quyết toán VAT. Bạn có chắc chắn?"
        confirmLabel="Xác nhận"
        onConfirm={handleCloseWithoutVat}
      />

      <ConfirmDialog
        open={reopenOpen}
        onOpenChange={setReopenOpen}
        title="Hoàn tác đóng công nợ (không xuất hóa đơn)"
        description="ERP sẽ khôi phục lại số tiền còn phải thu như trước khi đóng. Chỉ dùng khi bấm nhầm nút Đóng công nợ (không xuất hóa đơn) trước đó — sẽ bị chặn nếu công nợ này đã thuộc một Quyết toán VAT. Bạn có chắc chắn?"
        confirmLabel="Hoàn tác"
        onConfirm={handleReopenWithoutVat}
      />
    </div>
  );
}
