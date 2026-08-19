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

interface OpeningBalanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  onSaved: () => void;
}

// opening-balance.md — nhập Công nợ đầu kỳ (nợ cũ trước khi dùng phần mềm).
// Chỉ Create, không Update/Delete — giảm số dư qua ReduceOpeningBalanceDialog.
export function OpeningBalanceDialog({
  open,
  onOpenChange,
  customerId,
  onSaved,
}: OpeningBalanceDialogProps) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setAmount("");
    setNote("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      toast.error("Số tiền phải lớn hơn 0.");
      return;
    }

    setSaving(true);
    try {
      await apiPost("/opening-balances", {
        customerId,
        amount: amt,
        note: note.trim() || undefined,
      });
      toast.success("Đã thêm Công nợ đầu kỳ.");
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
          <DialogTitle>Thêm Công nợ đầu kỳ</DialogTitle>
        </DialogHeader>
        <form id="opening-balance-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ob-amount">Số tiền *</Label>
            <Input
              id="ob-amount"
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
            <Label htmlFor="ob-note">Ghi chú</Label>
            <Textarea
              id="ob-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Ví dụ: Nợ cũ trước khi dùng phần mềm..."
            />
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Huỷ</Button>
          <Button type="submit" form="opening-balance-form" disabled={saving || !amount}>
            {saving ? "Đang lưu..." : "Thêm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
