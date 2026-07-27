"use client";

import { useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared";
import { toast } from "sonner";
import { apiPost, ApiError } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CASH: "Tiền mặt",
  BANK_TRANSFER: "Chuyển khoản",
};

// 023-cong-no-payment-allocation-fifo: lịch sử thu tiền của 1 đơn giờ đọc qua
// PaymentAllocation, không còn Payment 1-1 receivableId trực tiếp — 1 Payment
// có thể cấn nhiều đơn (FIFO), nên "Số tiền" hiển thị ở đây là allocatedTotal
// (phần Payment đó cấn cho ĐÚNG đơn này), không phải payment.amount (tổng cả
// phiếu thu, có thể còn cấn cho đơn khác).
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
    // null = chưa từng bị hoàn tác — điều kiện hiện nút "Hoàn tác" (nút UI,
    // task sau 023-cong-no-payment-allocation-fifo).
    reversedBy: { id: string } | null;
  };
}

interface PaymentTableProps {
  allocations: AllocationRow[];
  onReversed?: () => void;
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("vi-VN").format(amount) + " ₫";
}

export function PaymentTable({ allocations, onReversed }: PaymentTableProps) {
  const { hasPermission } = useAuth();
  const [reverseTarget, setReverseTarget] = useState<{ id: string; code: string } | null>(null);

  async function handleReverse() {
    if (!reverseTarget) return;
    try {
      await apiPost(`/payments/${reverseTarget.id}/reverse`);
      toast.success(`Đã hoàn tác phiếu thu ${reverseTarget.code}.`);
      onReversed?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Lỗi kết nối server.");
    } finally {
      setReverseTarget(null);
    }
  }

  if (allocations.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">Chưa có khoản thanh toán nào.</p>;
  }

  const canReverse = hasPermission("debt.create-payment");

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-28">Mã phiếu thu</TableHead>
            <TableHead>Ngày thu</TableHead>
            <TableHead className="text-right">Số tiền</TableHead>
            <TableHead>Phương thức</TableHead>
            <TableHead>Số tham chiếu</TableHead>
            <TableHead>Ghi chú</TableHead>
            <TableHead>Người thu</TableHead>
            {canReverse && <TableHead className="w-28" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {allocations.map((a) => {
            const isReversal = a.payment.type === "REVERSAL";
            const canReverseThis = canReverse && !isReversal && !a.payment.reversedBy;
            return (
              <TableRow key={a.id}>
                <TableCell className="font-mono text-xs font-medium">
                  {a.payment.code}
                  {isReversal && (
                    <Badge variant="destructive" className="ml-2">Hoàn tác</Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm">{new Date(a.payment.paymentDate).toLocaleString("vi-VN")}</TableCell>
                <TableCell
                  className={`text-right font-mono text-sm font-semibold ${isReversal ? "text-destructive" : "text-green-600"}`}
                >
                  {isReversal ? "−" : ""}
                  {formatMoney(Number(a.allocatedTotal))}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{PAYMENT_METHOD_LABEL[a.payment.paymentMethod] ?? a.payment.paymentMethod}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{a.payment.referenceNumber ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{a.payment.note ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{a.payment.createdBy ?? "—"}</TableCell>
                {canReverse && (
                  <TableCell>
                    {canReverseThis && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setReverseTarget({ id: a.payment.id, code: a.payment.code })}
                      >
                        Hoàn tác
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <ConfirmDialog
        open={!!reverseTarget}
        onOpenChange={(open) => { if (!open) setReverseTarget(null); }}
        title="Hoàn tác phiếu thu"
        description={`ERP sẽ tạo một bút toán đảo chiều cho phiếu thu ${reverseTarget?.code ?? ""} (không sửa/xoá bản ghi gốc). Nếu phiếu thu này từng cấn cho NHIỀU đơn hàng khác nhau (ghi theo khách hàng), hoàn tác sẽ ảnh hưởng TẤT CẢ các đơn đó, không chỉ đơn đang xem. Bạn có chắc chắn?`}
        confirmLabel="Hoàn tác"
        variant="destructive"
        onConfirm={handleReverse}
      />
    </div>
  );
}
