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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { apiPost, apiPatch, ApiError } from "@/lib/api";
import { ConditionBuilder, type ConditionParameter } from "./condition-builder";

export interface ValidationRule {
  id: string;
  expression: string;
  severity: string;
  message: string;
  displayOrder: number;
}

interface ValidationRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  parameters: ConditionParameter[];
  item?: ValidationRule | null;
  onSaved: () => void;
}

export function ValidationRuleDialog({
  open,
  onOpenChange,
  productId,
  parameters,
  item,
  onSaved,
}: ValidationRuleDialogProps) {
  const isEdit = !!item;
  const [submitting, setSubmitting] = useState(false);
  const [expression, setExpression] = useState("");
  const [severity, setSeverity] = useState("WARN");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    if (item) {
      setExpression(item.expression);
      setSeverity(item.severity);
      setMessage(item.message);
    } else {
      setExpression("");
      setSeverity("WARN");
      setMessage("");
    }
  }, [open, item]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!expression.trim()) {
      toast.error("Biểu thức điều kiện là bắt buộc.");
      return;
    }
    if (!message.trim()) {
      toast.error("Thông báo là bắt buộc.");
      return;
    }

    setSubmitting(true);
    const body = { expression: expression.trim(), severity, message: message.trim() };

    try {
      if (isEdit) {
        await apiPatch(`/products/${productId}/validation-rules/${item.id}`, body);
      } else {
        await apiPost(`/products/${productId}/validation-rules`, body);
      }
      toast.success(isEdit ? "Cập nhật thành công." : "Thêm Validation Rule thành công.");
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
          <DialogTitle>{isEdit ? "Chỉnh sửa Validation Rule" : "Thêm Validation Rule"}</DialogTitle>
        </DialogHeader>

        <form id="validation-rule-form" onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Điều kiện VI PHẠM * (true → cảnh báo/chặn)</Label>
            <ConditionBuilder value={expression} onChange={setExpression} parameters={parameters} />
          </div>

          <div className="space-y-2">
            <Label>Mức độ</Label>
            <Select value={severity} onValueChange={(v) => setSeverity(v ?? "WARN")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WARN">WARN — Cảnh báo, vẫn cho tiếp tục</SelectItem>
                <SelectItem value="BLOCK">BLOCK — Chặn</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vr-message">Thông báo *</Label>
            <Textarea
              id="vr-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              placeholder="ví dụ: Kích thước bất thường so với hệ xích, vui lòng kiểm tra lại."
              required
            />
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button type="submit" form="validation-rule-form" disabled={submitting}>
            {submitting ? "Đang lưu..." : isEdit ? "Lưu thay đổi" : "Thêm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
