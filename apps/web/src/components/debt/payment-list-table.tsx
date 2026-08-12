"use client";

import { useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { apiPost, ApiError } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import { PAYMENT_METHOD_LABEL } from "./payment-table";

export interface PaymentListRow {
  id: string;
  code: string;
  type: string;
  paymentDate: string;
  amount: number;
  paymentMethod: string;
  referenceNumber: string | null;
  note: string | null;
  createdBy: string | null;
  reversedBy: { id: string } | null;
  customerName: string | null;
  customerPhone: string | null;
  orderCodes: string[];
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface PaymentListTableProps {
  rows: PaymentListRow[];
  meta: Meta;
  onPageChange: (page: number) => void;
  onReversed?: () => void;
  // false ở tab "Phiếu thu" trong trang khách hàng (đã biết sẵn khách nào,
  // cột này thừa) — true ở trang /debts/payments (gộp mọi khách hàng).
  showCustomer?: boolean;
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("vi-VN").format(amount) + " ₫";
}

// Bảng Phiếu thu dùng chung cho tab "Phiếu thu" (rà soát tab Công nợ,
// 11/08/2026) — khác payment-table.tsx (hiện lịch sử cấn trừ LỒNG TRONG 1 đơn
// cụ thể, cột "Số tiền" là allocatedTotal của riêng đơn đó): ở đây "Số tiền"
// là payment.amount (tổng cả phiếu, có thể cấn nhiều đơn cùng lúc qua FIFO —
// xem cột "Đơn hàng").
export function PaymentListTable({
  rows,
  meta,
  onPageChange,
  onReversed,
  showCustomer = true,
}: PaymentListTableProps) {
  const { hasPermission } = useAuth();
  const canReverse = hasPermission("debt.create-payment");
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

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">Không có phiếu thu nào khớp bộ lọc.</p>;
  }

  return (
    <div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Mã phiếu thu</TableHead>
              <TableHead>Ngày thu</TableHead>
              {showCustomer && <TableHead>Khách hàng</TableHead>}
              <TableHead className="text-right">Số tiền</TableHead>
              <TableHead>Phương thức</TableHead>
              <TableHead>Ghi chú</TableHead>
              <TableHead>Đơn hàng / Công nợ đầu kỳ</TableHead>
              <TableHead>Số tham chiếu</TableHead>
              <TableHead>Người thu</TableHead>
              {canReverse && <TableHead className="w-28" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p) => {
              const isReversal = p.type === "REVERSAL";
              const canReverseThis = canReverse && !isReversal && !p.reversedBy;
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs font-medium">
                    {p.code}
                    {isReversal && (
                      <Badge variant="destructive" className="ml-2">Hoàn tác</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{new Date(p.paymentDate).toLocaleString("vi-VN")}</TableCell>
                  {showCustomer && (
                    <TableCell>
                      <div className="font-medium">{p.customerName ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{p.customerPhone}</div>
                    </TableCell>
                  )}
                  <TableCell
                    className={`text-right font-mono text-sm font-semibold ${isReversal ? "text-destructive" : "text-green-600"}`}
                  >
                    {isReversal ? "−" : ""}
                    {formatMoney(Number(p.amount))}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{PAYMENT_METHOD_LABEL[p.paymentMethod] ?? p.paymentMethod}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.note ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.orderCodes.join(", ") || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.referenceNumber ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.createdBy ?? "—"}</TableCell>
                  {canReverse && (
                    <TableCell>
                      {canReverseThis && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setReverseTarget({ id: p.id, code: p.code })}
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
      </div>

      <div className="flex items-center justify-between px-2 py-4">
        <p className="text-sm text-muted-foreground">
          Hiển thị {rows.length} / {meta.total} phiếu thu
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onPageChange(meta.page - 1)} disabled={meta.page <= 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">{meta.page} / {meta.totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => onPageChange(meta.page + 1)} disabled={meta.page >= meta.totalPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={!!reverseTarget}
        onOpenChange={(open) => { if (!open) setReverseTarget(null); }}
        title="Hoàn tác phiếu thu"
        description={`ERP sẽ tạo một bút toán đảo chiều cho phiếu thu ${reverseTarget?.code ?? ""} (không sửa/xoá bản ghi gốc). Nếu phiếu thu này từng cấn cho NHIỀU đơn hàng khác nhau, hoàn tác sẽ ảnh hưởng TẤT CẢ các đơn đó. Bạn có chắc chắn?`}
        confirmLabel="Hoàn tác"
        variant="destructive"
        onConfirm={handleReverse}
      />
    </div>
  );
}
