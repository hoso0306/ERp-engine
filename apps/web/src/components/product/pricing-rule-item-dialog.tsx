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
import { ConditionBuilder, type ConditionParameter } from "./condition-builder";

export interface PricingRuleItem {
  id: string;
  ruleType: string;
  targetParameter: string | null;
  value: number;
  condition: string | null;
  rangeFrom: number | null;
  rangeTo: number | null;
  billValue: number | null;
  description: string | null;
  displayOrder: number;
}

interface PricingRuleItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  versionId: string;
  parameters: ConditionParameter[];
  item?: PricingRuleItem | null;
  onSaved: () => void;
}

export function PricingRuleItemDialog({
  open,
  onOpenChange,
  productId,
  versionId,
  parameters,
  item,
  onSaved,
}: PricingRuleItemDialogProps) {
  const isEdit = !!item;
  const [submitting, setSubmitting] = useState(false);
  const [ruleType, setRuleType] = useState("MIN_AREA");
  const [targetParameter, setTargetParameter] = useState("");
  const [value, setValue] = useState("");
  const [condition, setCondition] = useState("");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [billValue, setBillValue] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    if (item) {
      setRuleType(item.ruleType);
      setTargetParameter(item.targetParameter ?? "");
      setValue(String(item.value));
      setCondition(item.condition ?? "");
      setRangeFrom(item.rangeFrom !== null ? String(item.rangeFrom) : "");
      setRangeTo(item.rangeTo !== null ? String(item.rangeTo) : "");
      setBillValue(item.billValue !== null ? String(item.billValue) : "");
      setDescription(item.description ?? "");
    } else {
      setRuleType("MIN_AREA");
      setTargetParameter("");
      setValue("");
      setCondition("");
      setRangeFrom("");
      setRangeTo("");
      setBillValue("");
      setDescription("");
    }
  }, [open, item]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (ruleType === "MIN_DIMENSION" && !targetParameter.trim()) {
      toast.error("MIN_DIMENSION cần chỉ định tên thông số.");
      return;
    }
    if (ruleType !== "BILLABLE_STEP") {
      if (!value || Number(value) <= 0) {
        toast.error("Giá trị tối thiểu phải lớn hơn 0.");
        return;
      }
    } else if (!billValue || Number(billValue) <= 0) {
      toast.error("BILLABLE_STEP cần giá trị tính bằng lớn hơn 0.");
      return;
    }

    setSubmitting(true);
    const body: Record<string, unknown> = {
      ruleType,
      condition: condition.trim() || null,
      description: description.trim() || null,
    };
    if (ruleType === "MIN_DIMENSION") {
      body.targetParameter = targetParameter.trim();
    }
    if (ruleType === "BILLABLE_STEP") {
      body.targetParameter = targetParameter.trim() || null;
      body.rangeFrom = rangeFrom ? Number(rangeFrom) : null;
      body.rangeTo = rangeTo ? Number(rangeTo) : null;
      body.billValue = Number(billValue);
    } else {
      body.value = Number(value);
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
                <SelectItem value="MIN_VALUE">MIN_VALUE — Giá trị tối thiểu</SelectItem>
                <SelectItem value="BILLABLE_STEP">BILLABLE_STEP — Bậc thang</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(ruleType === "MIN_DIMENSION" || ruleType === "MIN_VALUE" || ruleType === "BILLABLE_STEP") && (
            <div className="space-y-2">
              <Label htmlFor="ri-target">
                Thông số áp dụng{ruleType === "BILLABLE_STEP" ? " (để trống = area)" : " *"}
              </Label>
              <Input
                id="ri-target"
                value={targetParameter}
                onChange={(e) => setTargetParameter(e.target.value)}
                placeholder="ví dụ: chieurong hoặc area"
              />
              <p className="text-xs text-muted-foreground">
                Nhập tên biến của thông số/biến phái sinh (tên biến, không phải nhãn).
              </p>
            </div>
          )}

          {ruleType === "BILLABLE_STEP" ? (
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ri-from">Từ (≥)</Label>
                <Input
                  id="ri-from"
                  type="number"
                  value={rangeFrom}
                  onChange={(e) => setRangeFrom(e.target.value)}
                  step="any"
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ri-to">Đến (&lt;)</Label>
                <Input
                  id="ri-to"
                  type="number"
                  value={rangeTo}
                  onChange={(e) => setRangeTo(e.target.value)}
                  step="any"
                  placeholder="0.7"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ri-bill">Tính bằng *</Label>
                <Input
                  id="ri-bill"
                  type="number"
                  value={billValue}
                  onChange={(e) => setBillValue(e.target.value)}
                  step="any"
                  min={0}
                  required
                />
              </div>
            </div>
          ) : (
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
          )}

          <ConditionBuilder value={condition} onChange={setCondition} parameters={parameters} />

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
