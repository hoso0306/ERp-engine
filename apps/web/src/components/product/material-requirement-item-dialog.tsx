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
import { ConditionBuilder, type ConditionParameter } from "./condition-builder";
import { MaterialTypeahead, type MaterialOption } from "@/components/warehouse/material-typeahead";
import type { DerivedParameter } from "./derived-parameter-dialog";

export interface MaterialRequirementItem {
  id: string;
  materialId: string;
  material: { id: string; code: string; name: string; unit: { id: string; name: string } | null };
  expression: string;
  condition: string | null;
  wastePercent: number;
  roundType: string;
  roundValue: number | null;
  note: string | null;
  displayOrder: number;
}

interface MaterialRequirementItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  versionId: string;
  parameters: ConditionParameter[];
  derivedParameters?: DerivedParameter[];
  item?: MaterialRequirementItem | null;
  onSaved: () => void;
}

export function MaterialRequirementItemDialog({
  open,
  onOpenChange,
  productId,
  versionId,
  parameters,
  derivedParameters = [],
  item,
  onSaved,
}: MaterialRequirementItemDialogProps) {
  const isEdit = !!item;
  const [submitting, setSubmitting] = useState(false);

  const [selectedMaterial, setSelectedMaterial] = useState<MaterialOption | null>(null);
  const [expression, setExpression] = useState("");
  const [condition, setCondition] = useState("");
  const [wastePercent, setWastePercent] = useState("0");
  const [roundStep, setRoundStep] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;

    if (item) {
      setSelectedMaterial(item.material);
      setExpression(item.expression);
      setCondition(item.condition ?? "");
      setWastePercent(String(item.wastePercent));
      setRoundStep(item.roundValue !== null ? String(item.roundValue) : "");
      setNote(item.note ?? "");
    } else {
      setSelectedMaterial(null);
      setExpression("");
      setCondition("");
      setWastePercent("0");
      setRoundStep("");
      setNote("");
    }
  }, [open, item]);

  const materialVariables = parameters.filter((p) => p.usedInMaterial);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMaterial) {
      toast.error("Vui lòng chọn vật tư.");
      return;
    }
    if (!expression.trim()) {
      toast.error("Công thức là bắt buộc.");
      return;
    }
    const waste = parseFloat(wastePercent) || 0;
    if (waste < 0) {
      toast.error("Tỷ lệ hao hụt không được âm.");
      return;
    }
    const rs = roundStep ? parseFloat(roundStep) : 0;
    if (rs < 0) {
      toast.error("Round Step không được âm.");
      return;
    }

    setSubmitting(true);
    const body: Record<string, unknown> = {
      materialId: selectedMaterial.id,
      expression: expression.trim(),
      condition: condition.trim() || null,
      wastePercent: waste,
      roundStep: rs || 0,
      note: note.trim() || null,
    };

    try {
      if (isEdit) {
        await apiPatch(
          `/products/${productId}/material-requirement/versions/${versionId}/items/${item.id}`,
          body,
        );
      } else {
        await apiPost(
          `/products/${productId}/material-requirement/versions/${versionId}/items`,
          body,
        );
      }

      toast.success(isEdit ? "Cập nhật thành công." : "Thêm công thức vật tư thành công.");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể lưu công thức vật tư.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Sửa công thức vật tư" : "Thêm công thức vật tư"}</DialogTitle>
        </DialogHeader>

        <form id="mat-req-item-form" onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Vật tư *</Label>
            <MaterialTypeahead value={selectedMaterial} onChange={setSelectedMaterial} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mri-expr">Công thức *</Label>
            <Textarea
              id="mri-expr"
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              rows={3}
              className="font-mono text-sm"
              placeholder="ví dụ: width * height * thickness"
            />
            <p className="text-xs text-muted-foreground">
              Công thức tính số lượng vật tư. Dùng tên biến của thông số sản phẩm.
            </p>
            {(materialVariables.length > 0 || derivedParameters.length > 0) && (
              <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium">Biến có thể dùng:</p>
                {materialVariables.length > 0 && (
                  <p className="font-mono">{materialVariables.map((p) => p.name).join(", ")}</p>
                )}
                {derivedParameters.map((dp) => (
                  <p key={dp.id}>
                    <code className="font-mono">{dp.name}</code>{" "}
                    <span>(= {dp.expression}, tự tính)</span>
                  </p>
                ))}
              </div>
            )}
          </div>

          <ConditionBuilder value={condition} onChange={setCondition} parameters={parameters} />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mri-waste">Hao hụt (%)</Label>
              <Input
                id="mri-waste"
                type="number"
                value={wastePercent}
                onChange={(e) => setWastePercent(e.target.value)}
                step="0.01"
                min={0}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">0 = không có hao hụt</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mri-round">Round Step</Label>
              <Input
                id="mri-round"
                type="number"
                value={roundStep}
                onChange={(e) => setRoundStep(e.target.value)}
                step="any"
                min={0}
                placeholder="Để trống = không làm tròn"
              />
              <p className="text-xs text-muted-foreground">Làm tròn lên (ceiling)</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mri-note">Ghi chú</Label>
            <Textarea
              id="mri-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Ghi chú về item này..."
            />
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button type="submit" form="mat-req-item-form" disabled={submitting}>
            {submitting ? "Đang lưu..." : isEdit ? "Lưu thay đổi" : "Thêm công thức vật tư"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
