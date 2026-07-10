"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader, Loading, ErrorState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, CreditCard } from "lucide-react";
import { RiskBadge } from "@/components/debt/risk-badge";
import { PaymentTable } from "@/components/debt/payment-table";
import { PaymentDialog } from "@/components/debt/payment-dialog";
import { apiGet, ApiError } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

interface Payment {
  id: string;
  code: string;
  paymentDate: string;
  amount: number;
  paymentMethod: string;
  referenceNumber: string | null;
  note: string | null;
  createdBy: string | null;
}

interface Receivable {
  id: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate: string | null;
  daysOverdue: number | null;
  riskLevel: string | null;
  payments: Payment[];
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Công nợ — ${receivable.salesOrder.code}`}
        description={`Khách hàng ${receivable.salesOrder.customerName}`}
        actions={
          <div className="flex gap-2 flex-wrap justify-end">
            <Button variant="outline" onClick={() => router.push("/debts")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Quay lại
            </Button>
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
            <span className="font-mono font-semibold">{formatMoney(Number(receivable.totalAmount))}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground w-36 shrink-0">Đã thu</span>
            <span className="font-mono font-semibold text-green-600">{formatMoney(Number(receivable.paidAmount))}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground w-36 shrink-0">Còn lại</span>
            <span className="font-mono font-semibold text-destructive">{formatMoney(Number(receivable.remainingAmount))}</span>
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
        <PaymentTable payments={receivable.payments} />
      </div>

      <PaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        salesOrderId={receivable.salesOrder.id}
        remainingAmount={Number(receivable.remainingAmount)}
        onSaved={fetchReceivable}
      />
    </div>
  );
}
