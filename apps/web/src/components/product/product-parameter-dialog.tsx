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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { apiPost, apiPatch, ApiError } from "@/lib/api";

interface ParameterOption {
  id: string;
  value: string;
  label: string | null;
  displayOrder: number;
}

export interface ProductParameter {
  id: string;
  name: string;
  label: string;
  type: string;
  unit: string | null;
  defaultValue: string | null;
  isRequired: boolean;
  minValue: number | null;
  maxValue: number | null;
  step: number | null;
  usedInPricing: boolean;
  usedInMaterial: boolean;
  displayOrder: number;
  options: ParameterOption[];
}

interface ProductParameterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  parameter?: ProductParameter | null;
  onSaved: () => void;
}

interface EditableOption {
  value: string;
  label: string;
}

export function ProductParameterDialog({
  open,
  onOpenChange,
  productId,
  parameter,
  onSaved,
}: ProductParameterDialogProps) {
  const isEdit = !!parameter;
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [type, setType] = useState("NUMBER");
  const [unit, setUnit] = useState("");
  const [defaultValue, setDefaultValue] = useState("");
  const [isRequired, setIsRequired] = useState(false);
  const [usedInPricing, setUsedInPricing] = useState(true);
  const [usedInMaterial, setUsedInMaterial] = useState(true);
  const [displayOrder, setDisplayOrder] = useState("0");
  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");
  const [step, setStep] = useState("");
  const [options, setOptions] = useState<EditableOption[]>([{ value: "", label: "" }]);

  useEffect(() => {
    if (!open) return;
    if (parameter) {
      setName(parameter.name);
      setLabel(parameter.label);
      setType(parameter.type);
      setUnit(parameter.unit ?? "");
      setDefaultValue(parameter.defaultValue ?? "");
      setIsRequired(parameter.isRequired);
      setUsedInPricing(parameter.usedInPricing);
      setUsedInMaterial(parameter.usedInMaterial);
      setDisplayOrder(String(parameter.displayOrder));
      setMinValue(parameter.minValue != null ? String(parameter.minValue) : "");
      setMaxValue(parameter.maxValue != null ? String(parameter.maxValue) : "");
      setStep(parameter.step != null ? String(parameter.step) : "");
      setOptions(
        parameter.options.length > 0
          ? parameter.options.map((o) => ({ value: o.value, label: o.label ?? "" }))
          : [{ value: "", label: "" }],
      );
    } else {
      setName("");
      setLabel("");
      setType("NUMBER");
      setUnit("");
      setDefaultValue("");
      setIsRequired(false);
      setUsedInPricing(true);
      setUsedInMaterial(true);
      setDisplayOrder("0");
      setMinValue("");
      setMaxValue("");
      setStep("");
      setOptions([{ value: "", label: "" }]);
    }
  }, [open, parameter]);

  function addOption() {
    setOptions((prev) => [...prev, { value: "", label: "" }]);
  }

  function removeOption(idx: number) {
    setOptions((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateOption(idx: number, field: "value" | "label", val: string) {
    setOptions((prev) =>
      prev.map((o, i) => (i === idx ? { ...o, [field]: val } : o)),
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error("Tên thông số là bắt buộc."); return; }
    if (!label.trim()) { toast.error("Nhãn hiển thị là bắt buộc."); return; }
    if (type === "ENUM" && !options.some((o) => o.value.trim())) {
      toast.error("Kiểu ENUM cần có ít nhất một lựa chọn.");
      return;
    }

    setSubmitting(true);

    const body: Record<string, unknown> = {
      name: name.trim(),
      label: label.trim(),
      type,
      unit: unit.trim() || null,
      defaultValue: defaultValue.trim() || null,
      isRequired,
      usedInPricing,
      usedInMaterial,
      displayOrder: parseInt(displayOrder, 10) || 0,
    };

    if (type === "NUMBER") {
      body.minValue = minValue ? Number(minValue) : null;
      body.maxValue = maxValue ? Number(maxValue) : null;
      body.step = step ? Number(step) : null;
    }

    if (type === "ENUM") {
      body.options = options
        .filter((o) => o.value.trim())
        .map((o, idx) => ({
          value: o.value.trim(),
          label: o.label.trim() || null,
          displayOrder: idx,
        }));
    }

    try {
      if (isEdit) {
        await apiPatch(`/products/${productId}/parameters/${parameter.id}`, body);
      } else {
        await apiPost(`/products/${productId}/parameters`, body);
      }

      toast.success(isEdit ? "Cập nhật thành công." : "Thêm thông số thành công.");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể lưu thông số.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Chỉnh sửa thông số" : "Thêm thông số"}</DialogTitle>
        </DialogHeader>

        <form
          id="param-form"
          onSubmit={onSubmit}
          className="space-y-4 max-h-[60vh] overflow-y-auto pr-1"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="p-name">Tên biến *</Label>
              <Input
                id="p-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ví dụ: width"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-label">Nhãn hiển thị *</Label>
              <Input
                id="p-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="ví dụ: Chiều rộng"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Kiểu dữ liệu *</Label>
              <Select value={type} onValueChange={(v) => setType(v ?? "NUMBER")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NUMBER">Số (NUMBER)</SelectItem>
                  <SelectItem value="TEXT">Văn bản (TEXT)</SelectItem>
                  <SelectItem value="ENUM">Danh sách (ENUM)</SelectItem>
                  <SelectItem value="BOOLEAN">Có/Không (BOOLEAN)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-unit">Đơn vị</Label>
              <Input
                id="p-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="ví dụ: mm"
              />
            </div>
          </div>

          {type === "NUMBER" && (
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="p-min">Tối thiểu</Label>
                <Input
                  id="p-min"
                  type="number"
                  value={minValue}
                  onChange={(e) => setMinValue(e.target.value)}
                  placeholder="—"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-max">Tối đa</Label>
                <Input
                  id="p-max"
                  type="number"
                  value={maxValue}
                  onChange={(e) => setMaxValue(e.target.value)}
                  placeholder="—"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-step">Bước nhảy</Label>
                <Input
                  id="p-step"
                  type="number"
                  value={step}
                  onChange={(e) => setStep(e.target.value)}
                  placeholder="—"
                />
              </div>
            </div>
          )}

          {type === "ENUM" && (
            <div className="space-y-2">
              <Label>Danh sách lựa chọn *</Label>
              <div className="space-y-2">
                {options.map((opt, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      value={opt.value}
                      onChange={(e) => updateOption(idx, "value", e.target.value)}
                      placeholder="Giá trị"
                      className="w-32 shrink-0"
                    />
                    <Input
                      value={opt.label}
                      onChange={(e) => updateOption(idx, "label", e.target.value)}
                      placeholder="Nhãn hiển thị"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeOption(idx)}
                      disabled={options.length === 1}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addOption}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Thêm lựa chọn
              </Button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="p-default">Giá trị mặc định</Label>
              <Input
                id="p-default"
                value={defaultValue}
                onChange={(e) => setDefaultValue(e.target.value)}
                placeholder={
                  type === "BOOLEAN"
                    ? "true / false"
                    : type === "ENUM"
                      ? "Giá trị từ danh sách"
                      : "Mặc định"
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-order">Thứ tự hiển thị</Label>
              <Input
                id="p-order"
                type="number"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(e.target.value)}
                min={0}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-1">
            <div className="flex items-center gap-3">
              <input
                id="p-required"
                type="checkbox"
                checked={isRequired}
                onChange={(e) => setIsRequired(e.target.checked)}
                className="h-4 w-4 rounded border"
              />
              <Label htmlFor="p-required" className="cursor-pointer font-normal">
                Bắt buộc nhập
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <input
                id="p-pricing"
                type="checkbox"
                checked={usedInPricing}
                onChange={(e) => setUsedInPricing(e.target.checked)}
                className="h-4 w-4 rounded border"
              />
              <Label htmlFor="p-pricing" className="cursor-pointer font-normal">
                Dùng cho báo giá
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <input
                id="p-material"
                type="checkbox"
                checked={usedInMaterial}
                onChange={(e) => setUsedInMaterial(e.target.checked)}
                className="h-4 w-4 rounded border"
              />
              <Label htmlFor="p-material" className="cursor-pointer font-normal">
                Dùng cho định mức vật liệu
              </Label>
            </div>
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button type="submit" form="param-form" disabled={submitting}>
            {submitting ? "Đang lưu..." : isEdit ? "Lưu thay đổi" : "Thêm thông số"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
