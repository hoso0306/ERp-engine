"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface Unit {
  id: string;
  name: string;
}

interface MaterialData {
  id: string;
  code: string;
  name: string;
  unitId: string;
  isActive: boolean;
  note: string | null;
  retailPrice: number | string | null;
  minimumStock: number | string | null;
}

interface MaterialEditFormProps {
  material: MaterialData;
}

export function MaterialEditForm({ material }: MaterialEditFormProps) {
  const router = useRouter();
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitId, setUnitId] = useState(material.unitId);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/units`)
      .then((r) => r.json())
      .then(setUnits)
      .catch(() => {});
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);

    const form = new FormData(e.currentTarget);
    const retailPrice = form.get("retailPrice");
    const minimumStock = form.get("minimumStock");
    const body: Record<string, unknown> = {
      code: form.get("code"),
      name: form.get("name"),
      unitId,
      note: form.get("note") || null,
      retailPrice: retailPrice && String(retailPrice).trim() ? Number(retailPrice) : null,
      minimumStock: minimumStock && String(minimumStock).trim() ? Number(minimumStock) : null,
    };

    try {
      const res = await fetch(`${API_URL}/api/materials/${material.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.message || "Không thể cập nhật vật tư.");
        return;
      }

      toast.success("Cập nhật thành công.");
      router.push(`/materials/${material.id}`);
      router.refresh();
    } catch {
      toast.error("Lỗi kết nối server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-2xl">
      <fieldset className="space-y-4">
        <legend className="text-sm font-medium text-muted-foreground">Thông tin vật tư</legend>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="code">Mã vật tư *</Label>
            <Input id="code" name="code" defaultValue={material.code} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Tên vật tư *</Label>
            <Input id="name" name="name" defaultValue={material.name} required />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Đơn vị tính *</Label>
          <Select value={unitId} onValueChange={(v) => setUnitId(v ?? "")}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Chọn đơn vị" />
            </SelectTrigger>
            <SelectContent>
              {units.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="retailPrice">
              Giá bán lẻ (₫) <span className="text-muted-foreground">(tuỳ chọn)</span>
            </Label>
            <Input
              id="retailPrice"
              name="retailPrice"
              type="number"
              min="0"
              step="1000"
              defaultValue={material.retailPrice !== null ? Number(material.retailPrice) : ""}
            />
            <p className="text-xs text-muted-foreground">
              Dùng khi bán lẻ vật tư. Giá vốn sản xuất vẫn tính theo giá nhập.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="minimumStock">
              Tồn kho tối thiểu <span className="text-muted-foreground">(tuỳ chọn)</span>
            </Label>
            <Input
              id="minimumStock"
              name="minimumStock"
              type="number"
              min="0"
              step="any"
              defaultValue={material.minimumStock !== null ? Number(material.minimumStock) : ""}
            />
            <p className="text-xs text-muted-foreground">
              Tồn kho dưới mức này sẽ hiện cảnh báo.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="note">Ghi chú</Label>
          <Textarea id="note" name="note" rows={3} defaultValue={material.note ?? ""} />
        </div>
      </fieldset>

      <div className="flex gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Đang lưu..." : "Lưu thay đổi"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/materials/${material.id}`)}
        >
          Huỷ
        </Button>
      </div>
    </form>
  );
}
