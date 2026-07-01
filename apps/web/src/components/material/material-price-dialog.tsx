"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface MaterialPrice {
  id: string;
  price: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isDefault: boolean;
  note: string | null;
}

interface MaterialPriceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  materialId: string;
  price?: MaterialPrice | null;
  onSaved: () => void;
}

export function MaterialPriceDialog({
  open,
  onOpenChange,
  materialId,
  price,
  onSaved,
}: MaterialPriceDialogProps) {
  const isEdit = !!price;
  const [submitting, setSubmitting] = useState(false);
  const [isDefault, setIsDefault] = useState(price?.isDefault ?? false);

  useEffect(() => {
    setIsDefault(price?.isDefault ?? false);
  }, [price]);

  function formatDateForInput(dateStr: string | null | undefined) {
    if (!dateStr) return "";
    return dateStr.slice(0, 10);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);

    const form = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      price: Number(form.get("price")),
      effectiveFrom: form.get("effectiveFrom"),
      isDefault,
    };

    const effectiveTo = form.get("effectiveTo");
    if (effectiveTo && String(effectiveTo).trim()) {
      body.effectiveTo = String(effectiveTo).trim();
    } else {
      body.effectiveTo = null;
    }

    const note = form.get("note");
    body.note = note && String(note).trim() ? String(note).trim() : null;

    try {
      const url = isEdit
        ? `${API_URL}/api/materials/${materialId}/prices/${price.id}`
        : `${API_URL}/api/materials/${materialId}/prices`;

      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.message || "Không thể lưu giá nguyên liệu.");
        return;
      }

      toast.success(isEdit ? "Cập nhật giá thành công." : "Thêm giá thành công.");
      onOpenChange(false);
      onSaved();
    } catch {
      toast.error("Lỗi kết nối server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Chỉnh sửa giá" : "Thêm giá nguyên liệu"}</DialogTitle>
        </DialogHeader>

        <form id="price-form" onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="price">Giá mua (VNĐ) *</Label>
            <Input
              id="price"
              name="price"
              type="number"
              min={1}
              defaultValue={price?.price ?? ""}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="effectiveFrom">Hiệu lực từ *</Label>
              <Input
                id="effectiveFrom"
                name="effectiveFrom"
                type="date"
                defaultValue={formatDateForInput(price?.effectiveFrom)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="effectiveTo">Hết hiệu lực</Label>
              <Input
                id="effectiveTo"
                name="effectiveTo"
                type="date"
                defaultValue={formatDateForInput(price?.effectiveTo)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              id="isDefault"
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="h-4 w-4 rounded border"
            />
            <Label htmlFor="isDefault" className="cursor-pointer">
              Đặt làm giá mặc định
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Ghi chú</Label>
            <Textarea id="note" name="note" rows={2} defaultValue={price?.note ?? ""} />
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button type="submit" form="price-form" disabled={submitting}>
            {submitting ? "Đang lưu..." : isEdit ? "Lưu thay đổi" : "Thêm giá"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
