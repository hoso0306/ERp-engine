"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { apiPost, ApiError } from "@/lib/api";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salesOrderId: string;
  remainingAmount: number;
  onSaved: () => void;
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("vi-VN").format(amount) + " ₫";
}

export function PaymentDialog({ open, onOpenChange, salesOrderId, remainingAmount, onSaved }: PaymentDialogProps) {
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setAmount("");
    setPaymentMethod("CASH");
    setReferenceNumber("");
    setNote("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error("Số tiền phải lớn hơn 0."); return; }
    if (amt > remainingAmount) { toast.error("Số tiền không được vượt quá số còn phải thu."); return; }
    if (paymentMethod === "BANK_TRANSFER" && !referenceNumber.trim()) {
      toast.error("Vui lòng nhập số tham chiếu khi chuyển khoản.");
      return;
    }

    setSaving(true);
    try {
      await apiPost("/payments", {
        salesOrderId,
        amount: amt,
        paymentMethod,
        referenceNumber: referenceNumber.trim() || undefined,
        note: note.trim() || undefined,
      });
      toast.success("Đã ghi nhận thanh toán.");
      reset();
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Lỗi kết nối server.");
    } finally {
      setSaving(false);
    }
  }

  const needsReference = paymentMethod === "BANK_TRANSFER";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ghi nhận thanh toán</DialogTitle>
        </DialogHeader>
        <form id="payment-form" onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Còn phải thu: <span className="font-mono font-semibold text-foreground">{formatMoney(remainingAmount)}</span>
          </p>
          <div className="space-y-2">
            <Label htmlFor="payment-amount">Số tiền *</Label>
            <Input
              id="payment-amount"
              type="number"
              min="0"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Phương thức *</Label>
            <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v ?? "CASH")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CASH">Tiền mặt</SelectItem>
                <SelectItem value="BANK_TRANSFER">Chuyển khoản</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment-reference">
              Số tham chiếu {needsReference && "*"}
            </Label>
            <Input
              id="payment-reference"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder={needsReference ? "Bắt buộc khi chuyển khoản..." : "Không bắt buộc..."}
              required={needsReference}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment-note">Ghi chú</Label>
            <Textarea
              id="payment-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Huỷ</Button>
          <Button
            type="submit"
            form="payment-form"
            disabled={saving || !amount || (needsReference && !referenceNumber.trim())}
          >
            {saving ? "Đang lưu..." : "Ghi nhận thanh toán"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
