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
import { apiPost, apiPatch, ApiError } from "@/lib/api";

export interface DerivedParameter {
  id: string;
  name: string;
  expression: string;
  unit: string | null;
  displayOrder: number;
}

interface DerivedParameterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  item?: DerivedParameter | null;
  onSaved: () => void;
}

export function DerivedParameterDialog({
  open,
  onOpenChange,
  productId,
  item,
  onSaved,
}: DerivedParameterDialogProps) {
  const isEdit = !!item;
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [expression, setExpression] = useState("");
  const [unit, setUnit] = useState("");

  useEffect(() => {
    if (!open) return;
    if (item) {
      setName(item.name);
      setExpression(item.expression);
      setUnit(item.unit ?? "");
    } else {
      setName("");
      setExpression("");
      setUnit("");
    }
  }, [open, item]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Tên biến là bắt buộc.");
      return;
    }
    if (!expression.trim()) {
      toast.error("Công thức là bắt buộc.");
      return;
    }

    setSubmitting(true);
    const body = { name: name.trim(), expression: expression.trim(), unit: unit.trim() || null };

    try {
      if (isEdit) {
        await apiPatch(`/products/${productId}/derived-parameters/${item.id}`, body);
      } else {
        await apiPost(`/products/${productId}/derived-parameters`, body);
      }
      toast.success(isEdit ? "Cập nhật thành công." : "Thêm biến phái sinh thành công.");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể lưu.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Chỉnh sửa biến phái sinh" : "Thêm biến phái sinh"}</DialogTitle>
        </DialogHeader>

        <form id="derived-param-form" onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dp-name">Tên biến *</Label>
            <Input
              id="dp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ví dụ: area"
              className="font-mono"
              disabled={isEdit}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dp-expr">Công thức *</Label>
            <Textarea
              id="dp-expr"
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              rows={2}
              className="font-mono text-sm"
              placeholder="ví dụ: chieurong * chieucao / 10000"
              required
            />
            <p className="text-xs text-muted-foreground">
              Tính từ tham số gốc — dùng được cho cả công thức giá lẫn định mức vật tư.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dp-unit">Đơn vị</Label>
            <Input
              id="dp-unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="ví dụ: m²"
            />
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button type="submit" form="derived-param-form" disabled={submitting}>
            {submitting ? "Đang lưu..." : isEdit ? "Lưu thay đổi" : "Thêm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
