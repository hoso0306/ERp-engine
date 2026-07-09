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
import { MaterialTypeahead, type MaterialOption } from "./material-typeahead";

interface MaterialReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function MaterialReceiptDialog({ open, onOpenChange, onSaved }: MaterialReceiptDialogProps) {
  const [material, setMaterial] = useState<MaterialOption | null>(null);
  const [quantity, setQuantity] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setMaterial(null);
    setQuantity("");
    setSupplierName("");
    setNote("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!material) { toast.error("Vui lòng chọn vật tư."); return; }
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) { toast.error("Số lượng phải lớn hơn 0."); return; }

    setSaving(true);
    try {
      await apiPost("/material-receipts", {
        materialId: material.id,
        quantity: qty,
        supplierName: supplierName.trim() || undefined,
        note: note.trim() || undefined,
      });
      toast.success("Đã tạo phiếu nhập kho.");
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
          <DialogTitle>Tạo phiếu nhập kho</DialogTitle>
        </DialogHeader>
        <form id="material-receipt-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Vật tư *</Label>
            <MaterialTypeahead value={material} onChange={setMaterial} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="receipt-quantity">Số lượng *</Label>
            <Input
              id="receipt-quantity"
              type="number"
              min="0"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="receipt-supplier">Nhà cung cấp</Label>
            <Input
              id="receipt-supplier"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="Tên nhà cung cấp (tuỳ chọn)..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="receipt-note">Ghi chú</Label>
            <Textarea
              id="receipt-note"
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
            form="material-receipt-form"
            disabled={saving || !material || !quantity}
          >
            {saving ? "Đang lưu..." : "Tạo phiếu nhập"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
