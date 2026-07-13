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
import { apiGet, apiPost, apiPatch, ApiError } from "@/lib/api";
import { ConditionBuilder, type ConditionParameter } from "./condition-builder";

interface Material {
  id: string;
  code: string;
  name: string;
  unit: { id: string; name: string } | null;
}

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
  item?: MaterialRequirementItem | null;
  onSaved: () => void;
}

export function MaterialRequirementItemDialog({
  open,
  onOpenChange,
  productId,
  versionId,
  parameters,
  item,
  onSaved,
}: MaterialRequirementItemDialogProps) {
  const isEdit = !!item;
  const [submitting, setSubmitting] = useState(false);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);

  const [materialId, setMaterialId] = useState("");
  const [expression, setExpression] = useState("");
  const [condition, setCondition] = useState("");
  const [wastePercent, setWastePercent] = useState("0");
  const [roundStep, setRoundStep] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoadingMaterials(true);
    apiGet<{ data: Material[] }>("/materials?limit=200")
      .then((d) => setMaterials(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoadingMaterials(false));

    if (item) {
      setMaterialId(item.materialId);
      setExpression(item.expression);
      setCondition(item.condition ?? "");
      setWastePercent(String(item.wastePercent));
      setRoundStep(item.roundValue !== null ? String(item.roundValue) : "");
      setNote(item.note ?? "");
    } else {
      setMaterialId("");
      setExpression("");
      setCondition("");
      setWastePercent("0");
      setRoundStep("");
      setNote("");
    }
  }, [open, item]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!materialId) {
      toast.error("Vui lòng chọn vật tư.");
      return;
    }
    if (!expression.trim()) {
      toast.error("Expression là bắt buộc.");
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
      materialId,
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

      toast.success(isEdit ? "Cập nhật thành công." : "Thêm Item thành công.");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể lưu Item.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Chỉnh sửa Item" : "Thêm Item"}</DialogTitle>
        </DialogHeader>

        <form id="mat-req-item-form" onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Vật tư *</Label>
            <Select value={materialId} onValueChange={(v) => setMaterialId(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder={loadingMaterials ? "Đang tải..." : "Chọn vật tư..."} />
              </SelectTrigger>
              <SelectContent>
                {materials.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.code} — {m.name}
                    {m.unit ? ` (${m.unit.name})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mri-expr">Expression *</Label>
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
            {submitting ? "Đang lưu..." : isEdit ? "Lưu thay đổi" : "Thêm Item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
