"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { apiPost, ApiError } from "@/lib/api";

interface ReduceOpeningBalanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  openingBalance: { id: string; code: string; remainingAmount: number } | null;
  onSaved: () => void;
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("vi-VN").format(amount) + " ₫";
}

// opening-balance.md — Manual Override: giảm số dư Công nợ đầu kỳ, bắt buộc
// lý do (không phải Payment, không đụng FIFO engine).
export function ReduceOpeningBalanceDialog({
  open,
  onOpenChange,
  openingBalance,
  onSaved,
}: ReduceOpeningBalanceDialogProps) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setAmount("");
    setReason("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!openingBalance) return;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      toast.error("Số tiền giảm phải lớn hơn 0.");
      return;
    }
    if (amt > openingBalance.remainingAmount) {
      toast.error("Số tiền giảm không được vượt quá số dư còn lại.");
      return;
    }
    if (!reason.trim()) {
      toast.error("Vui lòng nhập lý do.");
      return;
    }

    setSaving(true);
    try {
      await apiPost(`/opening-balances/${openingBalance.id}/reduce`, {
        amount: amt,
        reason: reason.trim(),
      });
      toast.success("Đã giảm trừ Công nợ đầu kỳ.");
      reset();
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Lỗi kết nối server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Giảm trừ Công nợ đầu kỳ {openingBalance?.code}</DialogTitle>
        </DialogHeader>
        {openingBalance && (
          <form id="reduce-opening-balance-form" onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Số dư còn lại:{" "}
              <span className="font-mono font-semibold text-foreground">
                {formatMoney(openingBalance.remainingAmount)}
              </span>
            </p>
            <div className="space-y-2">
              <Label htmlFor="reduce-amount">Số tiền giảm *</Label>
              <Input
                id="reduce-amount"
                type="number"
                min="0"
                max={openingBalance.remainingAmount}
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reduce-reason">Lý do *</Label>
              <Textarea
                id="reduce-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Ví dụ: Khách thanh toán tiền mặt trực tiếp..."
                required
              />
            </div>
          </form>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Huỷ</Button>
          <Button
            type="submit"
            form="reduce-opening-balance-form"
            disabled={saving || !amount || !reason.trim()}
          >
            {saving ? "Đang lưu..." : "Giảm trừ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
