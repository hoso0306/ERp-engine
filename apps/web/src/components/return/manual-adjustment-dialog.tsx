"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { apiPost, ApiError } from "@/lib/api";

interface ManualAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receivableId: string;
  salesOrderCode: string;
  remainingAmount?: number;
  suggestedAmount?: number;
  suggestedReason?: string;
  returnId?: string;
  returnCode?: string;
  onSaved: () => void;
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n) + " ₫";
}

// Dùng chung cho 2 nơi: nút "Giảm trừ công nợ" ngay sau khi tạo phiếu hoàn
// thành công (returns/new) và nút dự phòng trên trang chi tiết Return
// (returns/[id], dùng khi bỏ qua/lỗi lúc tạo hoặc cần điều chỉnh thêm sau).
export function ManualAdjustmentDialog({
  open,
  onOpenChange,
  receivableId,
  salesOrderCode,
  remainingAmount,
  suggestedAmount,
  suggestedReason,
  returnId,
  returnCode,
  onSaved,
}: ManualAdjustmentDialogProps) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount(suggestedAmount && suggestedAmount > 0 ? String(suggestedAmount) : "");
      setReason(suggestedReason ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleSubmit() {
    const value = Number(amount);
    if (!value || value <= 0) {
      toast.error("Số tiền điều chỉnh phải lớn hơn 0.");
      return;
    }
    if (!reason.trim()) {
      toast.error("Vui lòng nhập lý do điều chỉnh.");
      return;
    }
    setSaving(true);
    try {
      const result = await apiPost<{ appliedAmount: number; requestedAmount: number }>(
        `/receivables/${receivableId}/manual-adjustment`,
        { amount: value, reason: reason.trim(), returnCode, returnId },
      );
      if (result.appliedAmount < result.requestedAmount) {
        const shortfall = result.requestedAmount - result.appliedAmount;
        toast.warning(
          `Chỉ giảm được ${formatMoney(result.appliedAmount)} (công nợ đã về 0). Còn ${formatMoney(shortfall)} chưa xử lý được, cần xử lý ngoài hệ thống.`,
          { duration: 10000 },
        );
      } else {
        toast.success("Đã giảm công nợ.");
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Lỗi kết nối server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Điều chỉnh giảm công nợ</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Giảm thẳng công nợ đơn {salesOrderCode}, không tạo phiếu thu — không ảnh hưởng báo cáo dòng tiền mặt.
          </p>
          <div className="space-y-2">
            <Label htmlFor="adjust-amount">Số tiền *</Label>
            <Input
              id="adjust-amount"
              type="number"
              min="1"
              max={remainingAmount}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {remainingAmount !== undefined && (
              <p className="text-xs text-muted-foreground">Còn phải thu: {formatMoney(remainingAmount)}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="adjust-reason">Lý do *</Label>
            <Textarea
              id="adjust-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Huỷ</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Đang lưu..." : "Xác nhận giảm công nợ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
