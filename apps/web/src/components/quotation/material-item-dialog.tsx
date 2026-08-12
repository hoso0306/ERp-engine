"use client";

import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { apiPost, apiPatch, ApiError } from "@/lib/api";
import { MaterialTypeahead, type MaterialOption } from "@/components/warehouse/material-typeahead";

// Bán lẻ vật tư trong Báo giá (chốt 28/07/2026, sprint-04/025) — dòng
// MATERIAL, không qua CTO/Pricing Rule. Giá cố định theo Material.retailPrice,
// không có Discount Engine (quyết định mục 2) — cho sửa tay finalPrice.
interface ExistingMaterialItem {
  id: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  materialUnit: string;
  quantity: number;
  finalPrice: number;
  note: string | null;
}

interface MaterialItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotationId: string;
  item?: ExistingMaterialItem | null;
  onSaved: () => void;
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n) + " ₫";
}

export function MaterialItemDialog({
  open,
  onOpenChange,
  quotationId,
  item,
  onSaved,
}: MaterialItemDialogProps) {
  const isEdit = !!item;

  const [pickedMaterial, setPickedMaterial] = useState<MaterialOption | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [finalPrice, setFinalPrice] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Đặt trong setTimeout để tránh cascading render (set-state-in-effect).
    const timer = setTimeout(() => {
      if (item) {
        setPickedMaterial({
          id: item.materialId,
          code: item.materialCode,
          name: item.materialName,
          unit: { id: "", name: item.materialUnit },
        });
        setQuantity(String(item.quantity));
        setFinalPrice(String(item.finalPrice));
        setNote(item.note ?? "");
      } else {
        setPickedMaterial(null);
        setQuantity("1");
        setFinalPrice("");
        setNote("");
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [open, item]);

  function onPickMaterial(m: MaterialOption | null) {
    setPickedMaterial(m);
    if (m && m.retailPrice !== null && m.retailPrice !== undefined && !isEdit) {
      setFinalPrice(String(Number(m.retailPrice)));
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) {
      toast.error("Số lượng phải lớn hơn 0.");
      return;
    }
    const price = finalPrice.trim() ? Number(finalPrice) : undefined;
    if (price !== undefined && price < 0) {
      toast.error("Giá bán không được âm.");
      return;
    }

    setSubmitting(true);
    try {
      if (isEdit) {
        await apiPatch(`/quotations/${quotationId}/material-items/${item!.id}`, {
          quantity: qty,
          finalPrice: price,
          note: note.trim() || null,
        });
        toast.success("Đã cập nhật vật tư.");
      } else {
        if (!pickedMaterial) {
          toast.error("Vui lòng chọn vật tư.");
          setSubmitting(false);
          return;
        }
        await apiPost(`/quotations/${quotationId}/material-items`, {
          materialId: pickedMaterial.id,
          quantity: qty,
          finalPrice: price,
          note: note.trim() || undefined,
        });
        toast.success("Đã thêm vật tư.");
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Lỗi kết nối server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Sửa vật tư" : "Thêm vật tư"}</DialogTitle>
        </DialogHeader>
        <form id="material-item-form" onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Vật tư *</Label>
            {isEdit ? (
              <div className="rounded-lg border px-3 py-2 text-sm">
                <span className="font-medium">{item!.materialName}</span>
                <span className="text-muted-foreground"> — {item!.materialCode}</span>
              </div>
            ) : (
              <MaterialTypeahead value={pickedMaterial} onChange={onPickMaterial} onlyRetailable />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="material-item-quantity">
                Số lượng * {(() => {
                  const unitName = pickedMaterial?.retailUnit?.name ?? pickedMaterial?.unit?.name;
                  return unitName ? `(${unitName})` : "";
                })()}
              </Label>
              <Input
                id="material-item-quantity"
                type="number"
                min="0"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="material-item-price">Giá bán (₫)</Label>
              <Input
                id="material-item-price"
                type="number"
                min="0"
                value={finalPrice}
                onChange={(e) => setFinalPrice(e.target.value)}
              />
            </div>
          </div>

          {finalPrice && quantity && Number(quantity) > 0 && (
            <p className="text-sm text-muted-foreground">
              Thành tiền: <span className="font-medium text-foreground">
                {formatMoney(Number(finalPrice) * Number(quantity))}
              </span>
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="material-item-note">Ghi chú</Label>
            <Textarea
              id="material-item-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Huỷ</Button>
          <Button
            type="submit"
            form="material-item-form"
            disabled={submitting || (!isEdit && !pickedMaterial)}
          >
            {submitting ? "Đang lưu..." : isEdit ? "Lưu thay đổi" : "Thêm vật tư"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
