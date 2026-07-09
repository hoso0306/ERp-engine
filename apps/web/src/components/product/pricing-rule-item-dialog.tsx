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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { apiPost, apiPatch, ApiError } from "@/lib/api";

export interface PricingRuleItem {
  id: string;
  ruleType: string;
  targetParameter: string | null;
  value: number;
  description: string | null;
  displayOrder: number;
}

interface PricingRuleItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  versionId: string;
  item?: PricingRuleItem | null;
  onSaved: () => void;
}

export function PricingRuleItemDialog({
  open,
  onOpenChange,
  productId,
  versionId,
  item,
  onSaved,
}: PricingRuleItemDialogProps) {
  const isEdit = !!item;
  const [submitting, setSubmitting] = useState(false);
  const [ruleType, setRuleType] = useState("MIN_AREA");
  const [targetParameter, setTargetParameter] = useState("");
  const [value, setValue] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    if (item) {
      setRuleType(item.ruleType);
      setTargetParameter(item.targetParameter ?? "");
      setValue(String(item.value));
      setDescription(item.description ?? "");
    } else {
      setRuleType("MIN_AREA");
      setTargetParameter("");
      setValue("");
      setDescription("");
    }
  }, [open, item]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value || Number(value) <= 0) {
      toast.error("Giá trị tối thiểu phải lớn hơn 0.");
      return;
    }
    if (ruleType === "MIN_DIMENSION" && !targetParameter.trim()) {
      toast.error("MIN_DIMENSION cần chỉ định tên thông số.");
      return;
    }

    setSubmitting(true);
    const body: Record<string, unknown> = {
      ruleType,
      value: Number(value),
      description: description.trim() || null,
    };
    if (ruleType === "MIN_DIMENSION") {
      body.targetParameter = targetParameter.trim();
    }

    try {
      if (isEdit) {
        await apiPatch(
          `/products/${productId}/pricing-rule/versions/${versionId}/items/${item.id}`,
          body,
        );
      } else {
        await apiPost(
          `/products/${productId}/pricing-rule/versions/${versionId}/items`,
          body,
        );
      }

      toast.success(isEdit ? "Cập nhật thành công." : "Thêm Rule thành công.");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể lưu Rule.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Chỉnh sửa Rule" : "Thêm Rule"}</DialogTitle>
        </DialogHeader>

        <form id="rule-item-form" onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Loại Rule *</Label>
            <Select value={ruleType} onValueChange={(v) => setRuleType(v ?? "MIN_AREA")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MIN_AREA">MIN_AREA — Diện tích tối thiểu</SelectItem>
                <SelectItem value="MIN_DIMENSION">MIN_DIMENSION — Chiều dài tối thiểu</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {ruleType === "MIN_DIMENSION" && (
            <div className="space-y-2">
              <Label htmlFor="ri-target">Thông số áp dụng *</Label>
              <Input
                id="ri-target"
                value={targetParameter}
                onChange={(e) => setTargetParameter(e.target.value)}
                placeholder="ví dụ: width"
              />
              <p className="text-xs text-muted-foreground">
                Nhập tên biến của thông số sản phẩm (tên biến, không phải nhãn).
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="ri-value">
              {ruleType === "MIN_AREA" ? "Diện tích tối thiểu *" : "Giá trị tối thiểu *"}
            </Label>
            <Input
              id="ri-value"
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              step="any"
              min={0}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ri-desc">Mô tả</Label>
            <Textarea
              id="ri-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Ghi chú về rule này..."
            />
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button type="submit" form="rule-item-form" disabled={submitting}>
            {submitting ? "Đang lưu..." : isEdit ? "Lưu thay đổi" : "Thêm Rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
