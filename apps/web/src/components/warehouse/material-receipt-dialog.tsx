"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiPost, ApiError } from "@/lib/api";
import { MaterialTypeahead, type MaterialOption } from "./material-typeahead";

interface MaterialReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

interface ReceiptRow {
  material: MaterialOption | null;
  quantity: string;
}

function emptyRow(): ReceiptRow {
  return { material: null, quantity: "" };
}

// Một phiếu nhập kho có thể gồm nhiều dòng vật tư (Sprint 04, chốt 16/07/2026) —
// mỗi dòng sinh đúng 1 WarehouseTransaction riêng ở BE, xem warehouse.service.ts.
export function MaterialReceiptDialog({ open, onOpenChange, onSaved }: MaterialReceiptDialogProps) {
  const [rows, setRows] = useState<ReceiptRow[]>([emptyRow()]);
  const [supplierName, setSupplierName] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setRows([emptyRow()]);
    setSupplierName("");
    setNote("");
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateRow(idx: number, patch: Partial<ReceiptRow>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const materialIds = new Set<string>();
    const items: { materialId: string; quantity: number }[] = [];
    for (const row of rows) {
      if (!row.material) { toast.error("Vui lòng chọn vật tư cho từng dòng."); return; }
      const qty = parseFloat(row.quantity);
      if (!qty || qty <= 0) { toast.error("Số lượng phải lớn hơn 0."); return; }
      if (materialIds.has(row.material.id)) {
        toast.error(`Vật tư "${row.material.name}" bị lặp lại trong phiếu.`);
        return;
      }
      materialIds.add(row.material.id);
      items.push({ materialId: row.material.id, quantity: qty });
    }

    setSaving(true);
    try {
      await apiPost("/material-receipts", {
        items,
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

  const canSubmit = rows.every((r) => r.material && r.quantity);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Tạo phiếu nhập kho</DialogTitle>
        </DialogHeader>
        <form id="material-receipt-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <Label>Vật tư *</Label>
            {rows.map((row, idx) => (
              <div key={idx} className="flex gap-2">
                <div className="flex-1">
                  <MaterialTypeahead
                    value={row.material}
                    onChange={(m) => updateRow(idx, { material: m })}
                  />
                </div>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={row.quantity}
                  onChange={(e) => updateRow(idx, { quantity: e.target.value })}
                  placeholder="Số lượng"
                  className="w-32 shrink-0"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRow(idx)}
                  disabled={rows.length === 1}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addRow}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Thêm dòng vật tư
            </Button>
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
            disabled={saving || !canSubmit}
          >
            {saving ? "Đang lưu..." : "Tạo phiếu nhập"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
